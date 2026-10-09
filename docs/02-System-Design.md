# System Design Document
## TicketHub — Architecture, Flows, and Design Decisions

---

## 1. High-Level Architecture

```mermaid
flowchart LR
    Client[React SPA<br/>Vite + React Query] -->|HTTPS / WSS| Nginx[Nginx<br/>Load Balancer]
    Nginx --> API1[Node/Express API #1]
    Nginx --> API2[Node/Express API #2]
    Nginx --> API3[Node/Express API #3]

    API1 & API2 & API3 --> Mongo[(MongoDB<br/>Replica Set)]
    API1 & API2 & API3 --> Redis[(Redis<br/>locks, cache, rate limit,<br/>socket adapter, queues)]

    Redis --> Worker[BullMQ Workers<br/>email, ticket PDF,<br/>expiry cleanup]
    Worker --> Mongo
    Worker --> SMTP[Email Provider]
    API1 & API2 & API3 --> PG[Payment Gateway<br/>Razorpay / Stripe]
    PG -->|Webhook| Nginx
    Worker --> Storage[(Object Storage<br/>ticket PDFs, images)]
```

**Style:** modular monolith. One codebase, one deployable API image, a separate worker process using the same code.

---

## 2. Backend Module Structure

```mermaid
flowchart TB
    subgraph API[Express App]
        Auth[auth]
        Users[users]
        Events[events]
        Venues[venues/seat maps]
        Booking[booking]
        Payments[payments]
        Tickets[tickets]
        Notif[notifications]
        Admin[admin]
    end
    Booking --> Events
    Booking --> Payments
    Payments --> Tickets
    Tickets --> Notif
    Admin --> Events
    Admin --> Users
    Common[shared: middleware, logger,<br/>errors, redis, db, config]
    API --> Common
```

Rule: modules talk through service interfaces, never through each other's models directly. This keeps a future microservice split cheap.

---

## 3. Core User Flow

```mermaid
flowchart TD
    A([Landing page]) --> B[Search / browse events]
    B --> C[Event detail page]
    C --> D{Logged in?}
    D -- No --> E[Login / Register] --> F
    D -- Yes --> F[Open live seat map]
    F --> G[Select up to 6 seats]
    G --> H{Locks acquired?}
    H -- No --> I[Show conflict, refresh map] --> F
    H -- Yes --> J[Checkout page<br/>5 min countdown]
    J --> K[Pay via gateway]
    K --> L{Payment result}
    L -- Success --> M[Booking CONFIRMED]
    M --> N[QR ticket + email sent async]
    N --> O([My Bookings])
    L -- Failed / timeout --> P[Locks released] --> F
```

---

## 4. Seat Locking and Booking Sequence (Centerpiece)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as React App
    participant API as Express API
    participant R as Redis
    participant DB as MongoDB
    participant WS as Socket.IO

    U->>FE: Select seats A1, A2
    FE->>API: POST /bookings/hold {eventId, seatIds}
    API->>R: Lua script: for each seat SET seat:event:seat NX EX 300 (all-or-nothing)
    alt any seat already locked
        R-->>API: fail (conflicting seats)
        API-->>FE: 409 Seats unavailable
    else all locked
        R-->>API: OK
        API->>DB: Insert booking {status: PENDING, expiresAt}
        API->>WS: emit seats:locked to room event:{id}
        API-->>FE: 201 {bookingId, expiresAt}
        WS-->>FE: Other viewers see A1, A2 greyed out
    end
    API->>API: Enqueue delayed job: expire booking at expiresAt
```

**Why a Lua script?** Locking multiple seats must be atomic. Without it, a user could lock A1, fail on A2, and leave A1 stuck. The script checks all keys, then sets all, or sets none.

**Lock value:** `bookingId` (or `userId:bookingId`) so only the owner can release or extend it (compare-and-delete on release).

---

## 5. Payment and Confirmation Sequence

```mermaid
sequenceDiagram
    actor U as User
    participant FE as React App
    participant API as Express API
    participant PG as Payment Gateway
    participant DB as MongoDB
    participant R as Redis
    participant Q as BullMQ
    participant WS as Socket.IO

    FE->>API: POST /payments/create-order {bookingId} + Idempotency-Key
    API->>R: Verify locks still owned; extend TTL
    API->>PG: Create order (amount, receipt=bookingId)
    PG-->>API: orderId
    API->>DB: Save payment {status: CREATED, orderId}
    API-->>FE: orderId
    FE->>PG: User completes payment
    PG-->>API: POST /webhooks/payment (signed)
    API->>API: Verify signature
    API->>DB: Find payment by gatewayPaymentId (idempotency check)
    alt already processed
        API-->>PG: 200 OK (no-op)
    else first time
        API->>DB: TRANSACTION: payment=PAID, booking=CONFIRMED, seats=BOOKED
        API->>R: Delete seat locks
        API->>WS: emit seats:booked
        API->>Q: Enqueue generate-ticket + send-email
        API-->>PG: 200 OK
    end
```

The final DB write is protected by a **unique index on `(eventId, seatId)` in the `booked_seats` collection**. Even if Redis fails, a double booking cannot be committed.

---

## 6. Seat State Machine

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE
    AVAILABLE --> LOCKED: user selects (Redis lock, TTL 5m)
    LOCKED --> AVAILABLE: TTL expires / user releases / payment fails
    LOCKED --> BOOKED: payment confirmed
    BOOKED --> AVAILABLE: booking cancelled / refunded
```

## 7. Booking State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> CONFIRMED: payment success
    PENDING --> EXPIRED: hold timeout
    PENDING --> FAILED: payment failed
    CONFIRMED --> CANCELLED: user cancels
    CANCELLED --> REFUNDED: refund processed
```

---

## 8. Lock Expiry and Cleanup Flow

```mermaid
flowchart TD
    A[Booking created PENDING] --> B[Delayed BullMQ job at expiresAt]
    B --> C{Booking still PENDING?}
    C -- No --> D([Do nothing])
    C -- Yes --> E[Mark EXPIRED]
    E --> F[Delete Redis locks if owned]
    F --> G[Emit seats:released via Socket.IO]
```

Redis TTL is the primary release mechanism. The delayed job is a safety net that cleans DB state and notifies clients.

---

## 9. Real-Time Updates

```mermaid
flowchart LR
    C1[Client A] <--> S1[API #1<br/>Socket.IO]
    C2[Client B] <--> S2[API #2<br/>Socket.IO]
    S1 <--> RA[(Redis Pub/Sub<br/>Socket.IO adapter)]
    S2 <--> RA
```

- Client joins room `event:{eventId}` when opening the seat map
- Server emits deltas only: `{seatIds, status}`
- On reconnect, client refetches the full seat map to resync
- Socket auth via JWT in handshake

---

## 10. Caching Strategy

| Data | Strategy | TTL | Invalidation |
|---|---|---|---|
| Event listing (by filters) | Cache-aside | 60 s | Event publish/update bumps a version key |
| Event detail | Cache-aside | 5 min | On update |
| Seat map (static layout) | Cache-aside | 1 h | On layout edit |
| Seat availability | Not cached long; derived from DB booked seats + Redis locks | n/a | Real-time |
| User session / refresh revocation | Redis | token TTL | On logout |

**Stampede protection:** per-key mutex (`SET lock:cache:key NX EX 5`) and TTL jitter (±10%).

---

## 11. Queue Design (BullMQ)

| Queue | Job | Retries | Notes |
|---|---|---|---|
| `email` | Send verification / confirmation / refund email | 5, exponential backoff | Dead-letter after max |
| `tickets` | Generate QR + PDF, upload to storage | 3 | Idempotent by bookingId |
| `booking-expiry` | Expire unpaid booking | 3 | Delayed job |
| `refunds` | Call gateway refund | 5 | Idempotency key |

Workers run as a separate container so API latency is unaffected.

---

## 12. Security Design

```mermaid
flowchart LR
    R[Request] --> H[helmet + CORS]
    H --> RL[Rate limiter<br/>per IP + per user]
    RL --> AU[JWT auth]
    AU --> RB[RBAC check]
    RB --> V[Zod validation]
    V --> C[Controller]
```

- Access token in memory; refresh token in `httpOnly`, `secure`, `sameSite` cookie
- Refresh token rotation with reuse detection (revoke the whole family on reuse)
- Webhook signature verification and raw body parsing
- Stricter limits on `/auth/*` and `/bookings/hold`
- Passwords hashed with argon2/bcrypt; secrets from env only
- Mongo query sanitization against operator injection

---

## 13. Scalability and Failure Handling

| Scenario | Behavior |
|---|---|
| API instance dies | Nginx routes to healthy instances; stateless so no loss |
| Redis down | Hold endpoint falls back to DB-based holds (`holds` collection with TTL index); cache bypassed; rate limiter fails open with logging |
| Worker down | Jobs persist in Redis; processed on restart |
| Gateway timeout | Booking stays PENDING; reconciliation job polls gateway for status |
| Webhook delayed | Lock TTL extended on order creation; reconciliation catches late payments |
| Payment succeeds but seat lost | Auto-refund flow triggered |

**Scaling path (talking points):** read replicas for Mongo, Redis Cluster, separate WebSocket service, CDN for static assets/images, sharding by `eventId`, and extracting payments/notifications into services.

---

## 14. Observability

- **Logging:** pino JSON logs with `requestId`, `userId`, `eventId`
- **Metrics:** request latency, lock success/failure rate, cache hit ratio, queue depth, active sockets (Prometheus-style `/metrics`)
- **Health:** `/health/live` and `/health/ready` (checks Mongo and Redis)
- **Tracing (optional):** OpenTelemetry

---

## 15. Key Design Decisions and Trade-offs

| Decision | Chosen | Alternative | Why |
|---|---|---|---|
| Architecture | Modular monolith | Microservices | Lower complexity, same boundaries |
| Seat hold | Redis lock + DB unique index | DB-only pessimistic locks | Fast, TTL built in, DB as safety net |
| Pagination | Cursor-based | Skip/limit | Stable and fast on large sets |
| Real-time | Socket.IO | SSE / polling | Rooms, reconnection, adapter support |
| Async work | BullMQ | Cron / inline | Retries, delays, visibility |
| Payments | Webhook as source of truth | Client callback | Client can lie or disconnect |
| Consistency | Mongo transaction at confirm | Eventual only | Booking and seats must change together |
