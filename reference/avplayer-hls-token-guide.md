# Playing protected classes in iOS AVPlayer — the URL transform

> Companion to the main *Client Integration Guide*. Read that first for login, token refresh, and the
> `/playback` endpoint. This guide covers the one extra step iOS needs.
> Verified end-to-end against production on 2026-08-20.

## The problem

`GET /api/classes/{classId}/playback` returns a signed video URL in **query-string form**:

```
https://<cdn-host>/<path>/master.m3u8?token=<T>&token_path=<P>&expires=<E>
```

HLS playlists reference their child playlists and segments by **relative URL** (`240p.m3u8`,
`240p_0.ts`). When a player resolves those against the master URL, the query string is dropped —
that's standard URL resolution, not a bug. So:

- the master playlist loads fine (it has the token),
- every child playlist and segment goes out **without** the token,
- the CDN answers **403**, and AVPlayer treats it as fatal and stops.

On Android this was worked around by intercepting each request and re-appending the query
parameters (ExoPlayer lets you do that). **AVPlayer has no such hook** — its HLS networking is
closed, and `AVAssetResourceLoaderDelegate` never fires for plain `https://` loads. Don't go down
that road; there is a simpler fix.

## The fix: move the token into the URL path

The CDN accepts the same credential in a **path-embedded form**, as a prefix segment:

```
https://<cdn-host>/bcdn_token=<T>&token_path=<P>&expires=<E>/<path>/master.m3u8
```

Because the token now lives in the *path*, relative resolution preserves it — every child
playlist and segment request automatically inherits it. No interception, no delegate, no proxy.

The values are **exactly the ones from the `/playback` response URL**: same `token` (as
`bcdn_token`), same `token_path`, same `expires`. Nothing is re-signed; you are only rearranging
the URL.

### Worked example

`/playback` returns:

```
https://cdn.example.b-cdn.net/472/64f.../hls/master.m3u8?token=HS256-AbC...XyZ&token_path=%2F472%2F64f...%2Fhls%2F&expires=1787230400
```

Feed AVPlayer:

```
https://cdn.example.b-cdn.net/bcdn_token=HS256-AbC...XyZ&token_path=%2F472%2F64f...%2Fhls%2F&expires=1787230400/472/64f.../hls/master.m3u8
```

### ⚠️ The one thing that goes wrong: `token_path` encoding

`token_path` arrives **percent-encoded** in the query string (`%2F472%2F...%2Fhls%2F`) and it
**must stay percent-encoded** in the path prefix. Most HTTP/URL libraries decode query parameters
automatically — if you read `token_path` through such an API you'll get `/472/.../hls/` and build
a broken URL. Either read the raw query string, or re-encode the decoded value (every `/` must
become `%2F`).

### Swift implementation

```swift
/// Converts the /playback query-form URL into the path-embedded form AVPlayer needs.
func avPlayerURL(fromPlaybackURL url: URL) -> URL? {
    guard var comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
          let rawQuery = comps.percentEncodedQuery else { return nil }

    // Parse the RAW query so token_path keeps its %2F encoding.
    var raw: [String: String] = [:]
    for pair in rawQuery.split(separator: "&") {
        let kv = pair.split(separator: "=", maxSplits: 1).map(String.init)
        if kv.count == 2 { raw[kv[0]] = kv[1] }
    }
    guard let token = raw["token"],
          let tokenPath = raw["token_path"],
          let expires = raw["expires"] else { return nil }

    let prefix = "/bcdn_token=\(token)&token_path=\(tokenPath)&expires=\(expires)"
    comps.percentEncodedPath = prefix + comps.percentEncodedPath
    comps.query = nil
    return comps.url
}

// Usage:
// let playbackURL = ... // "url" field from GET /api/classes/{classId}/playback
// let item = AVPlayerItem(url: avPlayerURL(fromPlaybackURL: playbackURL)!)
```

The transform is player-agnostic — the same path-form URL also plays in ExoPlayer, hls.js, VLC,
and ffmpeg, so you can unify on it across platforms if you want to drop the Android interceptor.

## Verifying it without an app

Take a fresh URL from `/playback` and check both forms with curl (do this within the URL's
lifetime — see expiry below):

```sh
# 1. Reproduce the failure: child playlist without the token -> 403
curl -s -o /dev/null -w '%{http_code}\n' "https://<cdn-host>/<path>/240p.m3u8"

# 2. The path form: master, child, and a segment all -> 200
curl -s -o /dev/null -w '%{http_code}\n' "https://<cdn-host>/bcdn_token=<T>&token_path=<P>&expires=<E>/<path>/master.m3u8"
curl -s -o /dev/null -w '%{http_code}\n' "https://<cdn-host>/bcdn_token=<T>&token_path=<P>&expires=<E>/<path>/240p.m3u8"
```

(Quote the URLs — they contain `&`.)

## Expiry and recovery

The rules from the main guide still apply, with one AVPlayer-specific difference:

- **Never store or reuse a signed URL.** Call `/playback` fresh every time playback starts.
- The signed URL expires (`expires` is a unix timestamp — read it, don't assume a duration).
  On other platforms the recipe is "renew at 80% and swap the token on future requests"; **AVPlayer
  can't swap** — the token is baked into the item's URL.
- So on iOS, recover by **replacing the player item**: when the URL is past ~80% of its lifetime
  or the player errors with a request failure mid-play, call `/playback` again, build a new
  path-form URL, create a new `AVPlayerItem`, `replaceCurrentItem(with:)`, and seek to the previous
  position. Expect a brief rebuffer; keep it rare by only doing it when needed.
- A **403/404-style failure at start** is not an expiry problem — check the API response codes
  from `/playback` first (`403` not entitled, `404` no recording, `425` still processing, `401`
  refresh your login token), exactly as the main guide describes.
