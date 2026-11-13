---
tenant: vidyagram
date: 2026-11-12
source: vidyagram-admin a71a05570, read from route and handler code (reference/scripts/route_auth_inventory.cjs plus an id-source pass); not from traffic
---

# Vidyagram API lock audit: steps 4 and 5

Step 4 = routes with no lock that carry a student id or perform a student action. Step 5 = routes that take the
student's id from the request (URL, body or query) instead of the login token, whatever lock they have.

Limits: the id source is found by pattern-matching the route's final handler. A handler that reads the id through a
validated schema or inside a service is listed under *Uncertain*. 'token' means the handler also reads the logged-in
user, so it may already compare the two; each of those needs a look before it is called safe.

## Step 4: no lock today (129 routes)

### Student actions (write as a student) (55)

| Route | Id from | Reads token |
|---|---|---|
| `POST /api/blog-comments` | schema? |  |
| `POST /api/blog-comments/:id/like` | body+query |  |
| `POST /api/books/user-ebook` | none found |  |
| `POST /api/courses/report-class` | schema? |  |
| `POST /api/current-affairs/days/:date/video-views` | none found |  |
| `POST /api/ebooks/user-ebook` | none found |  |
| `POST /api/editorial/feedback` | body |  |
| `POST /api/editorial/like` | body |  |
| `POST /api/editorial/part-attempt` | none found |  |
| `POST /api/editorial/save` | body |  |
| `POST /api/editorial-journals/:id/like` | none found |  |
| `POST /api/editorial-journals/:id/parts/:part/attempt` | none found |  |
| `POST /api/editorial-journals/:id/parts/attempt` | none found |  |
| `POST /api/editorial-journals/:id/save` | none found |  |
| `POST /api/feeds/:id/comments` | none found |  |
| `POST /api/feeds/:id/comments/:commentId/like` | none found |  |
| `POST /api/feeds/:id/comments/:commentId/replies` | none found |  |
| `POST /api/feeds/:id/comments/:commentId/replies/:replyId/like` | none found |  |
| `POST /api/feeds/:id/like` | none found |  |
| `POST /api/feeds/:id/share` | none found |  |
| `POST /api/feeds/:id/view` | none found |  |
| `POST /api/grammar/subtopics/:id/like` | schema? |  |
| `POST /api/grammar/topics/:id/like` | schema? |  |
| `POST /api/latest-sections/:id/comments` | none found |  |
| `POST /api/latest-sections/:id/comments/:commentId/like` | none found |  |
| `POST /api/latest-sections/:id/comments/:commentId/replies` | none found |  |
| `POST /api/latest-sections/:id/comments/:commentId/replies/:replyId/like` | none found |  |
| `POST /api/latest-sections/:id/like` | none found |  |
| `POST /api/latest-sections/:id/share` | none found |  |
| `POST /api/latest-sections/:id/view` | none found |  |
| `POST /api/notices/:id/comments` | none found |  |
| `POST /api/notices/:id/comments/:commentId/like` | body |  |
| `POST /api/notices/:id/like` | body |  |
| `POST /api/notices/:id/poll/vote` | body |  |
| `POST /api/notices/:id/read` | body |  |
| `POST /api/notices/:id/view` | none found |  |
| `POST /api/notices/:id/vote` | body |  |
| `POST /api/save-user-track` | none found |  |
| `POST /api/search/click` | none found |  |
| `POST /api/series/live-test/register` | schema? |  |
| `POST /api/series/live-test/unregister` | schema? |  |
| `POST /api/shorts/:id/like` | body |  |
| `POST /api/testimonials/submit` | none found |  |
| `POST /api/updates/:id/like` | none found |  |
| `POST /api/v1/channels/:id/subscribe` | body |  |
| `POST /api/v1/messages/:id/react` | body+query | yes |
| `POST /api/v1/messages/:id/view` | body |  |
| `POST /api/v1/messages/:id/vote` | body+query | yes |
| `POST /api/v1/room/:id/notes` | none found |  |
| `POST /api/v1/users/device-token` | body |  |
| `DELETE /api/v1/users/device-token` | body |  |
| `POST /api/words/bookmark` | body |  |
| `POST /api/words/report` | none found |  |
| `POST /api/words/seen` | body |  |
| `POST /api/words/user-word` | body+query |  |

### Per-student reads, id in the URL (16)

| Route | Id from | Reads token |
|---|---|---|
| `GET /api/editorial-journals/:id/user/:userId` | url |  |
| `GET /api/explore-plans/screen/:screenId` | url+query |  |
| `GET /api/explore-plans/screen/:screenId/:userId` | url+query |  |
| `GET /api/notices/user/:userId` | url |  |
| `GET /api/packages/explore-editorial/:userId` | url |  |
| `GET /api/packages/explore-grammar/:userId` | url |  |
| `GET /api/packages/explore-grammer/:userId` | url |  |
| `GET /api/packages/explore-more-plans/:userId` | url |  |
| `GET /api/packages/explore-test-series/:userId` | url |  |
| `GET /api/packages/explore-vocab/:userId` | url |  |
| `GET /api/packages/explore-words/:userId` | url |  |
| `GET /api/plans/active/:userId` | url |  |
| `POST /api/plans/filter-active/:userId` | url | yes |
| `GET /api/series/registered-tests/:user_id` | url |  |
| `GET /api/user-test/allow-user-test-course/:userId/:seriesId/:courseId` | url |  |
| `GET /api/users/profile/:user_id` | url | yes |

### Browse or list calls that accept an optional student id (58)

| Route | Id from | Reads token |
|---|---|---|
| `POST /api/ai-test/generate` | body |  |
| `POST /api/banners` | schema? |  |
| `POST /api/banners` | schema? |  |
| `POST /api/banners/list` | body |  |
| `POST /api/banners/list` | body |  |
| `GET /api/blog-comments/blog/:blogId` | query |  |
| `GET /api/categories/stats/main-category` | query |  |
| `GET /api/categories/stats/overview` | query |  |
| `GET /api/categories/stats/trend` | query |  |
| `POST /api/coupons/apply-coupon` | body | yes |
| `GET /api/course-folders/:id` | schema? | yes |
| `POST /api/course-folders/:id` | schema? | yes |
| `GET /api/courses/:courseId/tests` | query | yes |
| `POST /api/courses/:courseId/todays-classes` | body |  |
| `GET /api/courses/:id/zones` | query | yes |
| `GET /api/courses/active` | query |  |
| `POST /api/courses/by-id-2` | body | yes |
| `GET /api/courses/report-class` | query |  |
| `GET /api/courses/topic-and-section` | query |  |
| `POST /api/courses/user` | body |  |
| `GET /api/current-affairs/quizzes` | query |  |
| `GET /api/current-affairs/stories` | query |  |
| `GET /api/current-affairs/videos` | query |  |
| `POST /api/exam-score/exams/:slug/evaluate` | schema? |  |
| `POST /api/get-practice-batch-detail-v5` | body |  |
| `POST /api/get-practice-batch-list-v5` | body |  |
| `POST /api/leader-board-home-batch` | body |  |
| `GET /api/notices/:id/poll/me` | query |  |
| `GET /api/packages/:id/zones` | query | yes |
| `GET /api/packages/:packageId/assigned-series` | body+query | yes |
| `POST /api/packages/enrolled-packages` | body |  |
| `POST /api/packages/free-packages` | body |  |
| `POST /api/packages/slug/:slug` | body |  |
| `POST /api/packages/user-package-analytics` | body |  |
| `GET /api/practice-batch/:id/zones` | query | yes |
| `POST /api/practice-batch/detail` | body |  |
| `POST /api/practice-batch/list` | body |  |
| `POST /api/series/ai-test` | body |  |
| `POST /api/series/daily-quiz` | schema? |  |
| `POST /api/series/live-test` | body |  |
| `POST /api/series/package/:main_menu_slug` | body+query |  |
| `POST /api/series/quiz` | body |  |
| `POST /api/series/type/:main_menu_slug` | body |  |
| `GET /api/shorts` | schema? |  |
| `GET /api/shorts/:id/like-status` | query |  |
| `GET /api/topics/:topicId/classes` | query |  |
| `GET /api/v1/channels` | query | yes |
| `GET /api/v1/channels/:id/messages` | query | yes |
| `GET /api/v1/channels/:id/pins` | query | yes |
| `GET /api/words` | query |  |
| `GET /api/words/:id` | body+query |  |
| `GET /api/words/bookmarked` | query |  |
| `GET /api/words/most-searched` | query |  |
| `GET /api/words/read` | query |  |
| `GET /api/words/search` | query |  |
| `GET /api/words/stats` | query |  |
| `GET /api/words/unread` | query |  |
| `GET /api/words/unread/search` | query |  |

## Step 5: student id taken from the request (174 routes, plus 39 uncertain)

### No lock at all (86)

| Route | Id from | Reads token |
|---|---|---|
| `POST /api/ai-test/generate` | body |  |
| `POST /api/banners/list` | body |  |
| `POST /api/banners/list` | body |  |
| `POST /api/blog-comments/:id/like` | body+query |  |
| `GET /api/blog-comments/blog/:blogId` | query |  |
| `GET /api/categories/stats/main-category` | query |  |
| `GET /api/categories/stats/overview` | query |  |
| `GET /api/categories/stats/trend` | query |  |
| `POST /api/coupons/apply-coupon` | body | yes |
| `GET /api/courses/:courseId/tests` | query | yes |
| `POST /api/courses/:courseId/todays-classes` | body |  |
| `GET /api/courses/:id/zones` | query | yes |
| `GET /api/courses/active` | query |  |
| `POST /api/courses/by-id-2` | body | yes |
| `GET /api/courses/report-class` | query |  |
| `GET /api/courses/topic-and-section` | query |  |
| `POST /api/courses/user` | body |  |
| `GET /api/current-affairs/quizzes` | query |  |
| `GET /api/current-affairs/stories` | query |  |
| `GET /api/current-affairs/videos` | query |  |
| `POST /api/editorial/feedback` | body |  |
| `POST /api/editorial/like` | body |  |
| `POST /api/editorial/save` | body |  |
| `GET /api/editorial-journals/:id/user/:userId` | url |  |
| `GET /api/explore-plans/screen/:screenId` | url+query |  |
| `GET /api/explore-plans/screen/:screenId/:userId` | url+query |  |
| `POST /api/get-practice-batch-detail-v5` | body |  |
| `POST /api/get-practice-batch-list-v5` | body |  |
| `POST /api/leader-board-home-batch` | body |  |
| `POST /api/notices/:id/comments/:commentId/like` | body |  |
| `POST /api/notices/:id/like` | body |  |
| `GET /api/notices/:id/poll/me` | query |  |
| `POST /api/notices/:id/poll/vote` | body |  |
| `POST /api/notices/:id/read` | body |  |
| `POST /api/notices/:id/vote` | body |  |
| `GET /api/notices/user/:userId` | url |  |
| `GET /api/packages/:id/zones` | query | yes |
| `GET /api/packages/:packageId/assigned-series` | body+query | yes |
| `POST /api/packages/enrolled-packages` | body |  |
| `GET /api/packages/explore-editorial/:userId` | url |  |
| `GET /api/packages/explore-grammar/:userId` | url |  |
| `GET /api/packages/explore-grammer/:userId` | url |  |
| `GET /api/packages/explore-more-plans/:userId` | url |  |
| `GET /api/packages/explore-test-series/:userId` | url |  |
| `GET /api/packages/explore-vocab/:userId` | url |  |
| `GET /api/packages/explore-words/:userId` | url |  |
| `POST /api/packages/free-packages` | body |  |
| `POST /api/packages/slug/:slug` | body |  |
| `POST /api/packages/user-package-analytics` | body |  |
| `GET /api/plans/active/:userId` | url |  |
| `POST /api/plans/filter-active/:userId` | url | yes |
| `GET /api/practice-batch/:id/zones` | query | yes |
| `POST /api/practice-batch/detail` | body |  |
| `POST /api/practice-batch/list` | body |  |
| `POST /api/series/ai-test` | body |  |
| `POST /api/series/live-test` | body |  |
| `POST /api/series/package/:main_menu_slug` | body+query |  |
| `POST /api/series/quiz` | body |  |
| `GET /api/series/registered-tests/:user_id` | url |  |
| `POST /api/series/type/:main_menu_slug` | body |  |
| `POST /api/shorts/:id/like` | body |  |
| `GET /api/shorts/:id/like-status` | query |  |
| `GET /api/topics/:topicId/classes` | query |  |
| `GET /api/user-test/allow-user-test-course/:userId/:seriesId/:courseId` | url |  |
| `GET /api/users/profile/:user_id` | url | yes |
| `GET /api/v1/channels` | query | yes |
| `GET /api/v1/channels/:id/messages` | query | yes |
| `GET /api/v1/channels/:id/pins` | query | yes |
| `POST /api/v1/channels/:id/subscribe` | body |  |
| `POST /api/v1/messages/:id/react` | body+query | yes |
| `POST /api/v1/messages/:id/view` | body |  |
| `POST /api/v1/messages/:id/vote` | body+query | yes |
| `POST /api/v1/users/device-token` | body |  |
| `DELETE /api/v1/users/device-token` | body |  |
| `GET /api/words` | query |  |
| `GET /api/words/:id` | body+query |  |
| `POST /api/words/bookmark` | body |  |
| `GET /api/words/bookmarked` | query |  |
| `GET /api/words/most-searched` | query |  |
| `GET /api/words/read` | query |  |
| `GET /api/words/search` | query |  |
| `POST /api/words/seen` | body |  |
| `GET /api/words/stats` | query |  |
| `GET /api/words/unread` | query |  |
| `GET /api/words/unread/search` | query |  |
| `POST /api/words/user-word` | body+query |  |

### Behind the student gate (watch-only today) (48)

| Route | Id from | Reads token |
|---|---|---|
| `GET /api/class-progress` | query |  |
| `POST /api/class-progress` | body |  |
| `POST /api/course-progress` | body |  |
| `POST /api/course-progress/mark-class-as-complete` | body |  |
| `POST /api/course-progress/mark-class-as-uncomplete` | body |  |
| `POST /api/courses/my-courses` | body | yes |
| `GET /api/daily-stats/:userId/my-stats` | url+query |  |
| `GET /api/daily-stats/my-stats` | url+query |  |
| `GET /api/home-stats/:userId` | url |  |
| `POST /api/orders/get-razorpay-order` | body | yes |
| `GET /api/rank-scores/user/:userId` | url |  |
| `GET /api/report-questions/user/:userId` | url |  |
| `GET /api/report-questions/user/:userId/questions` | url |  |
| `GET /api/report-questions/user/:userId/summary` | url |  |
| `GET /api/room-test-leaderboard/:user_id/:customer_id` | url |  |
| `GET /api/room-test-leaderboard/challenge-screen-home-data/:user_id/:customer_id` | url |  |
| `POST /api/room-test-leaderboard/match-history` | body |  |
| `GET /api/saved-questions/questions/:userId` | url |  |
| `GET /api/saved-questions/section-wise/:userId` | url |  |
| `GET /api/saved-questions/sections/:userId` | url |  |
| `GET /api/slot-machine/coupons/:userId` | url |  |
| `POST /api/slot-machine/redeem` | body |  |
| `POST /api/slot-machine/setup` | body | yes |
| `POST /api/typing-test/analysis` | body |  |
| `GET /api/typing-test/get-attempted-count/:user_id/:packageId` | url |  |
| `POST /api/typing-test/series` | body |  |
| `GET /api/user-coins/:user_id` | url |  |
| `GET /api/user-points/:user_id` | url |  |
| `GET /api/user-question-answers/by-attempt/:userId/:testSeriesId/:attemptNumber` | url |  |
| `POST /api/user-stats/journey-so-far` | body |  |
| `GET /api/user-test/allow-user-test-batch/:userId/:seriesId/:batchId` | url |  |
| `GET /api/user-test/allow-user-test/:userId/:seriesId` | url |  |
| `GET /api/user-test/allow-user-test/:userId/:seriesId/:packageId` | url |  |
| `POST /api/user-test/attempted` | body |  |
| `POST /api/user-test/attempted-by-types` | body |  |
| `POST /api/user-test/generated-unattempted` | body |  |
| `GET /api/user-test/get-result/:userId/:seriesId/:attempted_count` | url |  |
| `GET /api/user-test/get-strengths-weaknesses/:userId/:seriesId/:attempted_count` | url |  |
| `GET /api/user-test/get-topper-result/:userId/:seriesId/:attempted_count` | url |  |
| `GET /api/user-test/get-user-series-attempted-count/:userId/:seriesId` | url |  |
| `GET /api/user-test/question-stats/:seriesId/:sectionId/:questionId/:userId` | url |  |
| `GET /api/user-test/rank-data-by-zone/:userId/:seriesId/:attempted_count/:zoneId` | url |  |
| `GET /api/user-test/rank-data/:userId/:seriesId/:attempted_count` | url |  |
| `POST /api/user-test/resume-test` | body |  |
| `POST /api/user-test/save-pause-test` | body |  |
| `POST /api/user-test/save-pause-test-delete` | body |  |
| `GET /api/user-test/user-solution-new/:userId/:seriesId/:attempted_count` | url |  |
| `GET /api/views/user/:userId/history` | url |  |

### Login required, but any logged-in student passes (40)

| Route | Id from | Reads token |
|---|---|---|
| `GET /api/advance-notifications/in-app/:userId` | url |  |
| `DELETE /api/advance-notifications/in-app/:userId/:notificationId` | url |  |
| `POST /api/advance-notifications/in-app/:userId/:notificationId` | url |  |
| `PATCH /api/advance-notifications/in-app/:userId/:notificationId/read` | url |  |
| `POST /api/advance-notifications/in-app/:userId/:notificationId/read` | url |  |
| `DELETE /api/advance-notifications/in-app/:userId/clear-all` | url |  |
| `POST /api/advance-notifications/in-app/:userId/clear-all` | url |  |
| `PATCH /api/advance-notifications/in-app/:userId/read-all` | url |  |
| `POST /api/advance-notifications/in-app/:userId/read-all` | url |  |
| `POST /api/banners` | body | yes |
| `GET /api/current-affairs/my/days` | query |  |
| `POST /api/current-affairs/practice` | body |  |
| `POST /api/current-affairs/progress` | body |  |
| `GET /api/current-affairs/revise` | query |  |
| `GET /api/current-affairs/saved/items` | query |  |
| `GET /api/daily-quiz/calendar` | query |  |
| `POST /api/notifications/:id/track` | body |  |
| `GET /api/notifications/in-app/:userId` | url |  |
| `DELETE /api/notifications/in-app/:userId/:notificationId` | url |  |
| `POST /api/notifications/in-app/:userId/:notificationId` | url |  |
| `PATCH /api/notifications/in-app/:userId/:notificationId/read` | url |  |
| `POST /api/notifications/in-app/:userId/:notificationId/read` | url |  |
| `DELETE /api/notifications/in-app/:userId/clear-all` | url |  |
| `POST /api/notifications/in-app/:userId/clear-all` | url |  |
| `PATCH /api/notifications/in-app/:userId/read-all` | url |  |
| `POST /api/notifications/in-app/:userId/read-all` | url |  |
| `PUT /api/samaroh/:eventId/rsvp` | body |  |
| `PATCH /api/support-chat/read` | url |  |
| `GET /api/timetable` | url+body+query | yes |
| `POST /api/timetable` | url+body+query | yes |
| `GET /api/timetable/:userId` | url+body+query | yes |
| `POST /api/timetable/:userId` | url+body+query | yes |
| `GET /api/user-test/allow-user-test-course/:seriesId/:courseId` | url |  |
| `GET /api/users/:userId/apple-account-token` | url | yes |
| `POST /api/users/logout-session/:id` | url | yes |
| `GET /api/users/me/chat-bans` | body+query | yes |
| `POST /api/users/me/chat-bans` | body+query | yes |
| `POST /api/v1/channels/:id/mute` | body | yes |
| `DELETE /api/v1/channels/:id/mute` | body | yes |
| `PUT /api/vg-tests/modes` | body |  |

### Uncertain: id probably read through a validated schema (39)

| Route | Lock today |
|---|---|
| `POST /api/advance-notifications/demo-watch` | login |
| `POST /api/banners` | none |
| `POST /api/banners` | none |
| `POST /api/blog-comments` | none |
| `GET /api/course-folders/:id` | none |
| `POST /api/course-folders/:id` | none |
| `POST /api/courses/report-class` | none |
| `POST /api/exam-score/exams/:slug/evaluate` | none |
| `PUT /api/feedback` | login |
| `GET /api/feedback/mine` | login |
| `POST /api/grammar/subtopics/:id/like` | none |
| `POST /api/grammar/topics/:id/like` | none |
| `POST /api/notifications/demo-watch` | login |
| `POST /api/orders/payment-link` | student-gate (watch-only) |
| `GET /api/rank-scores` | student-gate (watch-only) |
| `POST /api/rank-scores/max` | student-gate (watch-only) |
| `GET /api/report-questions` | student-gate (watch-only) |
| `POST /api/report-questions` | student-gate (watch-only) |
| `GET /api/report-questions/all` | student-gate (watch-only) |
| `POST /api/report-questions/detail` | student-gate (watch-only) |
| `GET /api/saved-questions` | student-gate (watch-only) |
| `POST /api/saved-questions` | student-gate (watch-only) |
| `GET /api/saved-questions/all` | student-gate (watch-only) |
| `POST /api/saved-questions/unsave` | student-gate (watch-only) |
| `POST /api/series/daily-quiz` | none |
| `POST /api/series/live-test/register` | none |
| `POST /api/series/live-test/unregister` | none |
| `GET /api/shorts` | none |
| `POST /api/test-results` | student-gate (watch-only) |
| `POST /api/test-results/analysis` | student-gate (watch-only) |
| `POST /api/test-results/search` | student-gate (watch-only) |
| `POST /api/user-coins` | student-gate (watch-only) |
| `POST /api/user-points` | student-gate (watch-only) |
| `GET /api/user-question-answers` | student-gate (watch-only) |
| `GET /api/user-question-answers/all` | student-gate (watch-only) |
| `POST /api/user-test/save` | student-gate (watch-only) |
| `POST /api/users/fcm-token` | student-gate (watch-only) |
| `POST /api/users/zones` | login |
| `POST /api/views/track-class-view` | student-gate (watch-only) |
