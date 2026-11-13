# Discount codes and timer

**Type**: AFK
**Blocked by**: 03
**Repo**: Backend + admin

## What to build

A Discount codes row on Pricing attaches a coupon to the course's main plans, not its upgrade or add-on plans. Each code has a Show timer switch, off by default, counting down to the coupon's existing expiry date. The plan listing sends the setting beside the coupon code and end date it already sends. Start with one code per course, as one coupon attaches to one plan today.

## Acceptance criteria

- [ ] Attaching a code makes it appear with every main plan on the listing, and checkout applies it.
- [ ] The timer setting is on the listing, per course and code.
- [ ] An expired or inactive coupon sends no code and no timer.
- [ ] Removing the code detaches it from the plans.
- [ ] The app guide notes the new setting.
- [ ] `NO NEW FAILURES` against the baselines.

## User stories covered

- Stories 13, 14
