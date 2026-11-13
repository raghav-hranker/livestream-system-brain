# Pricing plans

**Type**: AFK
**Blocked by**: 01, 03
**Repo**: Backend + admin

## What to build

Access Duration Based Pricing on the Price row, with Add pricing plan. Each length is its own main plan with the same contents and offer terms. Removing a length stops new sales and keeps its plan active. A student who owns any length can't buy another. Follow task 01's findings on what the app needs.

## Acceptance criteria

- [ ] Two lengths create two plans, and each order takes its own validity.
- [ ] Editing a length keeps its plan id, and removing one leaves its buyers with access.
- [ ] An owner of either length isn't offered the other.
- [ ] The course card shows the first length's price.
- [ ] iPhone: course-made plans have no Apple product id. Record what the app does, since no Vidyagram plan had one on 22 Oct either.
- [ ] If task 01 found app work, the guide says so and the switch stays hidden until it ships.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 10, 11, 12

## From task 01 (2026-11-06)

The app already shows every plan of a course at checkout, so a second length needs no app work. There is no switch any
more (user, 2026-11-07): the backend that allows several lengths is live (f4cf64085), and the form shows Add pricing plan
as soon as the admin (`feat/vg-course-selling` 30338ddcc) is deployed.
- **iPhone:** the app's purchase screen (`lib/screens/orders/explore_purchase_screen.dart` in hranker-com/vidyagram) refuses a plan
  with no `apple_product_id` ("This plan is not available for purchase on iOS."). A plan the course form makes has none, so
  an added length, or the first plan of a new course, can't be bought on iPhone until someone gives it an App Store product
  (the app repo's `scripts/iap_update`). Connected courses keep their existing plan and its product id.

