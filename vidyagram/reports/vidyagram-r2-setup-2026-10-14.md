# Vidyagram recorded-video R2 setup

Completed through Deepak (Work)'s Chrome Cloudflare dashboard. Verification used the browser and curl, as permitted by step 8.

## Account, hostname and bucket

- Account: **Deepaksharma7933@gmail.com's Account**
- Account ID: `1ff6f2000c9aa34ca2ec88c066af092a`
- Reference bucket: `recordedvideos-hranker-v2`; custom domain `recordedvideosv2.hranker.org` remains Active.
- Target hostname: **vidyagram-recorded.hranker.org**
- Reason for fallback: `vidyagramar.com` is absent from this account. The account's domain list contains hranker.org, topperswisdom.com, unlimitededucation.in and unlimitededuction.in. Its plan was therefore not available in this account.
- Target zone: `hranker.org`, **Pro**; zone ID `37006234a9c877df3cc0faca5ef6f1da`.
- New bucket: **recordedvideos-vidyagram**
- Location: Asia-Pacific (APAC), matching the reference; APAC location hint selected under default jurisdiction.
- Storage class: **Standard**
- Custom domain: **Active**, access Enabled. HTTPS requests succeeded with curl's certificate verification enabled.
- Public development (`r2.dev`) URL: **Disabled**.

## CORS policy

Read from the reference bucket and applied to the new bucket:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Range", "Accept-Ranges"],
    "MaxAgeSeconds": 86400
  }
]
```

## URL rewrite

Original: `vod-r2-path-token`, hranker.org, Active, order 2.

```text
Match:
http.host eq "recordedvideosv2.hranker.org" and starts_with(http.request.uri.path, "/v/")

Dynamic path:
wildcard_replace(raw.http.request.uri.path, "/v/*/472/*", "/472/${2}")

Dynamic query:
wildcard_replace(raw.http.request.uri.path, "/v/*/472/*", "vodauth=${1}")
```

New: `vidyagram recorded: token path rewrite`, hranker.org, Active, order 4. Rule ID: `472f2738e21f4923b60db43adb3799c9`.

```text
Match:
http.host eq "vidyagram-recorded.hranker.org" and starts_with(http.request.uri.path, "/v/")

Dynamic path:
wildcard_replace(raw.http.request.uri.path, "/v/*/781/*", "/781/${2}")

Dynamic query:
wildcard_replace(raw.http.request.uri.path, "/v/*/781/*", "vodauth=${1}")
```

The reference hardcodes customer 472. Raghav explicitly approved replacing 472 with 781 in the new rule; the original remains unchanged.

## Signed-URL WAF

Original: `video guard r2`, hranker.org, Active, order 4. Action: Block; default Cloudflare WAF block page, HTTP 403.

```text
(http.host eq "recordedvideosv2.hranker.org" and http.request.method ne "OPTIONS" and not is_timed_hmac_valid_v0("<SECRET>",
concat(substring(http.request.uri.path, 0, 34), "?verify=", http.request.uri.args["vodauth"][0]), 21600, http.request.timestamp.sec, 8, "s"))
```

New: `vidyagram recorded: signed URL check`, hranker.org, Active, order 5, immediately after `video guard r2`. Rule ID: `ef3a70f6bc3e4f41b53bab6e74d2c7cd`. Same action and response settings.

```text
(http.host eq "vidyagram-recorded.hranker.org" and http.request.method ne "OPTIONS" and not is_timed_hmac_valid_v0("<SECRET>",
concat(substring(http.request.uri.path, 0, 34), "?verify=", http.request.uri.args["vodauth"][0]), 21600, http.request.timestamp.sec, 8, "s"))
```

Generated a cryptographically random 256-bit secret (64 hex characters), as Raghav requested. Verified its presence in the deployed WAF rule without exposing it in this report. The 34-character prefix, message construction, TTL 21600, argument 8 and flag "s" are preserved. OPTIONS requests remain exempt, matching the reference.

## Cache rules

Only one cache rule matched the reference hostname.

| Item | Original | New |
| --- | --- | --- |
| Name | vod-cache-r2 | vidyagram recorded: vod-cache-r2 |
| Zone | hranker.org | hranker.org |
| Expression | `http.host eq "recordedvideosv2.hranker.org"` | `http.host eq "vidyagram-recorded.hranker.org"` |
| Status/order | Active / 2 | Active / 5 |
| Rule ID | ddf332057c4e48e68adbae14c419532f | e2bd5a6245244b81b8a1468ab040d2a8 |

Duplicated the reference rule, changing only its name and hostname. Both use:

- Eligible for cache for all matching paths, including .m3u8 and .ts.
- Edge TTL: ignore origin cache-control and use 1 hour.
- Status TTL: 200–299 = 1 year; 404 = 10 seconds; 500–599 = No store.
- Browser TTL: override origin, 1 year.
- Cache key: ignore query string; include Origin header. No additional header values, cookies or presence checks configured.
- Cache deception armor, device-type separation and query-string sorting: off.
- No optional overrides added for Vary, Cache Reserve, origin range requests, stale revalidation, strong ETags or origin error page pass-through.

Tiered Cache topology is **off** in hranker.org. Since target and reference use the same zone, no setting change was needed.

## Ingest credentials

- Token name: **vidyagram-ingest** (Account API token).
- Permission: **Object Read & Write**.
- Scope: only **recordedvideos-vidyagram**.
- Expiry: **Forever**; no client IP filters.
- Access Key ID: `a10f3c5e617f496371ba38e3c7efa513`
- S3 endpoint: `https://1ff6f2000c9aa34ca2ec88c066af092a.r2.cloudflarestorage.com`
- Account ID: `1ff6f2000c9aa34ca2ec88c066af092a`

Raghav subsequently authorized saving the Secret Access Key, other R2 credentials, and the generated WAF signing secret in `/Users/raghav/Projects/system-brain/.env.development`. This new file has mode 0600 and is excluded from Git through `/.env.development` in .gitignore. Saved values were verified without printing secrets; the one-time token page was then closed via Finish.

Variable names: `VIDYAGRAM_R2_ACCOUNT_ID`, `VIDYAGRAM_R2_ACCESS_KEY_ID`, `VIDYAGRAM_R2_SECRET_ACCESS_KEY`, `VIDYAGRAM_R2_ENDPOINT`, `VIDYAGRAM_R2_BUCKET`, `VIDYAGRAM_RECORDED_CDN_HOST`, `VIDYAGRAM_CF_HMAC_SECRET`.

## Verification

| Request/check | Result |
| --- | --- |
| `https://vidyagram-recorded.hranker.org/781/test/hls/master.m3u8` | HTTP/2 **403**, Cloudflare block response; curl ray `a4a076e77fd23afb-BOM`; browser ray `a4a076945ddb482c` |
| `https://vidyagram-recorded.hranker.org/v/123-abc/781/test/hls/master.m3u8` | HTTP/2 **403**, Cloudflare block response; ray `a4a0770dada60b2c-BOM` |
| New bucket r2.dev URL | Disabled |
| Reference custom domain | recordedvideosv2.hranker.org still Active |
| Reference rewrite | Still Active with original hostname and /472/ expressions |
| Reference WAF | Still Active with original hostname, message, prefix, TTL and action; inspected and exited without saving |
| Reference cache rule | Original hostname, TTLs and cache-key switches match the recorded values |

No pre-existing Cloudflare resource was modified or deleted. New rules were created by Duplicate. Differences from the initial instructions are the approved /781/ rewrite substitution, generating the signing secret, and saving credentials locally at Raghav's later request. Browser full-screen mode was exited to restore native input. A valid signed playback request was not part of the requested checks; no test media was uploaded.
