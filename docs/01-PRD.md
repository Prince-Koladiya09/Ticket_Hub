# Product Requirements Document (PRD)
## TicketHub — Event Ticket Booking Platform (MERN)

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Draft |
| Stack | MongoDB, Express, React, Node.js, Redis, BullMQ, Socket.IO |
| Level | Mid-level portfolio project |

---

## 1. Overview

### 1.1 Problem Statement
Booking tickets for popular events suffers from three problems: double booking when many users pick the same seat, stale seat availability, and slow, unreliable checkout under load.

### 1.2 Product Vision
A reliable, real-time ticket booking platform where users see live seat availability, hold seats safely during checkout, and receive instant tickets, while organizers manage events and track sales.

### 1.3 Goals
- Zero double-booked seats under concurrent load
- Seat status updates visible to all viewers within 1 second
- Browse/search p95 latency under 200 ms (cached)
- Payment flow that is safe against retries and duplicate webhooks

### 1.4 Non-Goals (v1)
- Native mobile apps
- Dynamic pricing / resale marketplace
- Multi-currency and tax engines
- Microservice split (modular monolith instead)

---

## 2. Users and Personas

| Persona | Description | Key Needs |
|---|---|---|
| **Attendee (User)** | Browses events and buys tickets | Fast search, live seat map, safe payment, tickets in email |
| **Organizer** | Creates and manages events | Event/venue setup, seat map config, sales dashboard |
| **Admin** | Platform operator | Approve events, manage users, view platform metrics |

---

## 3. User Stories

### Attendee
- US-01: As a user, I can register/login so my bookings are tied to my account.
- US-02: As a user, I can search and filter events by city, date, category, and price.
- US-03: As a user, I can view a live seat map and see seats taken by others in real time.
- US-04: As a user, I can select seats and have them held for 5 minutes while I pay.
- US-05: As a user, I can pay online and receive a QR-code ticket by email.
- US-06: As a user, I can view and download my past bookings.
- US-07: As a user, I can cancel a booking before the cutoff and get a refund.

### Organizer
- US-08: As an organizer, I can create events with venue, date, pricing tiers, and seat layout.
- US-09: As an organizer, I can edit or cancel my event.
- US-10: As an organizer, I can view sales, occupancy, and revenue per event.
- US-11: As an organizer, I can scan/validate tickets at entry (QR check-in).

### Admin
- US-12: As an admin, I can approve/reject events and suspend users.
- US-13: As an admin, I can view platform-level analytics.

---

## 4. Functional Requirements

### 4.1 Authentication and Authorization (P0)
- FR-1: Email/password registration with email verification
- FR-2: JWT access token (15 min) + refresh token (7 days) with rotation
- FR-3: Role-based access control: `user`, `organizer`, `admin`
- FR-4: Logout invalidates refresh token (server-side revocation list in Redis)

### 4.2 Event Management (P0)
- FR-5: CRUD for events (organizer-owned)
- FR-6: Event has venue, schedule, category, banner image, seat map, pricing tiers
- FR-7: Event states: `draft → pending_approval → published → completed / cancelled`
- FR-8: Admin approval before publish

### 4.3 Discovery (P0)
- FR-9: Text search on title/description/city
- FR-10: Filters: city, category, date range, price range
- FR-11: Cursor-based pagination
- FR-12: Cached listing and detail pages

### 4.4 Seat Selection and Locking (P0)
- FR-13: Seat states: `AVAILABLE`, `LOCKED`, `BOOKED`
- FR-14: Selecting seats creates a Redis lock with 5-minute TTL
- FR-15: Max 6 seats per booking
- FR-16: Lock released on timeout, explicit release, or payment failure
- FR-17: Seat state changes broadcast to all viewers of that event in real time

### 4.5 Booking and Payment (P0)
- FR-18: Booking created in `PENDING` state when locks are acquired
- FR-19: Payment via Razorpay/Stripe (test mode) with idempotency keys
- FR-20: Webhook confirms payment, transitions booking to `CONFIRMED`
- FR-21: Duplicate webhooks must not create duplicate bookings
- FR-22: Unpaid bookings auto-expire and release seats

### 4.5.1 Booking State Machine
`PENDING → CONFIRMED → (CANCELLED | REFUNDED)` and `PENDING → EXPIRED / FAILED`

### 4.6 Tickets and Notifications (P1)
- FR-23: Generate QR-code ticket (PDF) after confirmation (async)
- FR-24: Send confirmation email with ticket attached (async)
- FR-25: Booking history page with ticket download

### 4.7 Cancellation and Refund (P1)
- FR-26: Cancel allowed up to 24 hours before event
- FR-27: Refund initiated via payment gateway; seats returned to `AVAILABLE`

### 4.8 Organizer Dashboard (P1)
- FR-28: Sales summary, revenue, seat occupancy per event
- FR-29: QR check-in endpoint for entry validation

### 4.9 Admin Panel (P2)
- FR-30: Approve/reject events, suspend users, view metrics

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Cached reads p95 < 200 ms; seat lock acquisition < 100 ms |
| **Scalability** | Stateless API, horizontally scalable behind Nginx; Socket.IO via Redis adapter |
| **Availability** | Health checks, graceful shutdown, restart-on-failure |
| **Consistency** | No double bookings (Redis lock + DB unique index + transaction) |
| **Security** | OWASP basics: helmet, validation, rate limiting, password hashing (bcrypt/argon2), CORS allowlist |
| **Reliability** | Idempotent payment handling, retry with backoff for jobs, dead-letter queue |
| **Observability** | Structured logs (pino) with request IDs, `/health` and `/metrics` |
| **Maintainability** | Modular architecture, ESLint, tests for critical flows |

---

## 6. Success Metrics

| Metric | Target |
|---|---|
| Double bookings under load test | 0 |
| Concurrent users in k6 test | 500+ with <1% errors |
| Cache hit ratio on event listing | > 80% |
| Seat update propagation | < 1 s |
| Booking completion rate (funnel) | Tracked |
| Failed webhook reprocessing | 0 duplicates |

---

## 7. Assumptions and Constraints
- Payments run in test/sandbox mode only
- Single region deployment
- Email via SMTP sandbox (Mailtrap) or SES
- Seat maps are grid-based (rows x columns) with sections

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Race condition on same seat | Double booking | Atomic Redis `SET NX` + unique DB index + transaction |
| Redis outage | Locks/cache lost | Fall back to DB-level check; persist booking holds in DB with `expiresAt` |
| Duplicate webhooks | Duplicate bookings | Idempotency key + unique `paymentId` index |
| Cache stampede on hot event | DB overload | Request coalescing / mutex, TTL jitter |
| Lock expires during payment | User pays but seat lost | Extend lock on payment init; reconcile via webhook; auto-refund if seat gone |
| Socket fan-out cost | High load | Room-per-event, send delta updates only |

---

## 9. Release Plan

| Phase | Scope |
|---|---|
| **MVP (v0.1)** | Auth, events, search, seat map, booking without locks |
| **v0.5** | Redis locks, transactions, live updates |
| **v0.8** | Payments, webhooks, queues, email/QR tickets |
| **v1.0** | Caching, rate limiting, dashboard, Docker/Nginx, load tests, docs |

---

## 10. Open Questions
- Reserved seating only, or also general admission with quantity limits?
- Refund policy tiers (full/partial)?
- Should organizers set their own cancellation windows?
