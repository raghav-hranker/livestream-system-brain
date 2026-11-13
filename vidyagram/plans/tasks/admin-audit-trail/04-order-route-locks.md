# Locks on order reads/writes and assign plan

**Type**: AFK
**Blocked by**: 02
**Repo**: backend

## What to build

Put the task 02 gate on the order routes that let anyone read every order or grant themselves a course.

- **`ROUTE_GATE_ORDER_READ`.**
  - `GET /api/orders`, `/stats`, `POST /orders/course/:courseId`: `admin`.
  - `/history`, `POST /orders/user`, `GET /orders/:id`: `self-or-admin` (the order's or the query's user).
  - The quicktricks order-read lock (`858ee6f5f` + `0ee1286ec`, deployed there) is the source.
- **`ROUTE_GATE_ORDER_WRITE`.**
  - `POST /orders/assign-plan` and `/assign-plans`: `admin`.
  - `PUT /orders/:id`: `admin`.
  - `POST /api/orders` and package-order create/update: `self-or-admin` when they create an order for a student,
    because the app's purchase flow uses them. Check the Razorpay and IAP paths still work with the student's token.
  - The quicktricks order-write lock (`75d0063e2` + `0b65faabe`, built, never deployed there) is the source. Read why
    it wasn't deployed (memory note `backend-authz-gaps`) before copying it.
- Open order reads also return `Order.exchange`. Nothing extra is needed: the lock covers it.
- **Callers** per route, as in task 02. The purchase flow must be named explicitly.

## Acceptance criteria

- [ ] Integration: for each route in `enforce`, no login gives 401, another student 403, the order's own student 200
      where `self-or-admin`, and an admin 200.
- [ ] Integration: a student can't assign a plan to themself or anyone else.
- [ ] Integration: a student can still create their own purchase order with their token.
- [ ] The report lists callers per route, including the app's purchase flow and whether it sends a token.
- [ ] `NO NEW FAILURES` against the backend baseline.

## User stories covered

- Stories 43, 45, 46
