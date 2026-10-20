# Vidyagram Course Builder — Postman

Collection: `vidyagram-course-builder.postman_collection.json` (24 requests, 6 folders). Run the folders in
order: folder 1 reads the course outline and saves the chapter, class and placement ids the later requests use.

## Quick start (local)

Import both files into Postman and pick the environment **Vidyagram Course Builder (local)**:
`vidyagram-course-builder.postman_collection.json` and
`vidyagram-course-builder.local.postman_environment.json`. The environment is already filled for the local
server: admin and student tokens (signed with the local server's own secret, valid 7 days), the test
student, the invented SSC Aditya course, and a test ("Postman: Number System test") tagged to the chapter the
collection grants. Then run the collection; no edits needed. The environment file is not committed: the
tokens only work against the local server and expire, so regenerate it rather than reuse an old one.

## Variables (environment, or collection variables)

| Variable | Local | Live |
|---|---|---|
| `base` | `http://localhost:5914/api` (default) | `https://backend.vidyagramar.com/api` |
| `adminToken` | the local test admin token (session scratchpad `vg-mongo/admin.token`) | an admin's login token (admin site → DevTools → Local Storage → `admin_token`) |
| `studentToken` | mint one with the local JWT secret (below) | a test student's app login token |
| `studentId` | that student's `_id` | that test student's `_id` |
| `courseId` | `6ad4cce38edc65f31e7c7698` (the invented local course, default) | a course with Course Builder settings saved |
| `seriesId` | the seeded "Postman: Number System test" | a test assigned to that course and tagged with the granted chapter |

Mint a local student token (local only; the secret is the local server's own):

```sh
cd ~/Projects/worktrees/vg-builder-backend && SECRET=$(grep '^JWT_SECRET=' .env.localpreview | cut -d= -f2) node -e 'console.log(require("jsonwebtoken").sign({user_id:process.argv[1]},process.env.SECRET,{expiresIn:"7d"}))' <studentId>
```

## What each folder checks

1. **Admin: builder settings.** Reads the outline and settings; re-saves them unchanged (version goes up);
   a save with weights short of 100% is refused (400); marks and unmarks one class as revision.
2. **Admin: price preview.** Prices the saved settings: whole course 799, Notes off 699, both off 549,
   Revision only 449, one chapter with both off held at the 199 minimum. These numbers assume max 799, min
   199, Notes 100, Tests 150, Revision-only discount 350; on another course read the printed prices instead.
3. **Student: builder screen.** Signed out has no ownership; signed in prints what the student owns.
4. **Buy or grant.** Admin grants the student one chapter with Notes and Tests; checkout prices a second chapter on the
   server (the body's `grandTotal: 1` is ignored); a coupon is refused (400); no login is refused (401).
5. **Student: access.** A class of the granted chapter is not refused; a class of another chapter is 403;
   the test gate answers for the token's user and refuses another user's id in the URL (403).
6. **Listings.** My Courses lists the course with `isPartial` and the granted chapter; the course page and
   My Purchases print the ownership and the build.

## Before running on live

These requests **write**: "Save builder settings" (re-saves the same values), "Mark/Unmark a class as revision",
"Admin: grant…" (creates a real zero-amount order that gives the student that chapter), and "Student:
checkout" (creates a real Razorpay order; nothing is charged unless someone pays it). Run them only with a
test student on a course you are allowed to change, and delete the granted order afterwards if needed
(deleting an order removes its access).

Last run: local, 2026-10-20, on the branch merged with origin/vidyagram-admin (backend 2ee01628d, admin 66dd030): 36/36 assertions passed, none skipped.
