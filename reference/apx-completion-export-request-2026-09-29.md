# Request to APX (Appx): video completion export — org 8680775

Hi team,

As part of Quicktricks by Sahil Sir's platform migration, we need a one-time
export of students' **manual video completion marks** (the "mark as complete"
flag served by `GET /get/getVideoCompletion?item_type=10`) for organisation
**8680775**.

Please share a CSV (or JSON) with one row per marked video:

| Column | Meaning |
|---|---|
| `user_id` | APX user id |
| `course_id` | APX course id (`item_id`) |
| `video_id` | APX video / course-entry id (the key in the `getVideoCompletion` map) |
| `status` | `1` completed, `0` unmarked (rows with `1` only are fine) |
| `updated_at` | when the mark was set, if you store it (optional) |

Scope: all users of org 8680775, all courses. We already hold user, course
and video ids from our earlier exports, so no names or contact details are
needed.

We can currently read these marks only through each student's own logged-in
token, which would mean sending a login OTP to more than 170,000 students.
An export avoids that entirely.

Thanks,
Raghav
