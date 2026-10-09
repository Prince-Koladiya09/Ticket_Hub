# TicketHub

Real-time event ticket booking platform built on the MERN stack, with a focus on system design:
atomic seat locking, live seat maps, async jobs, caching and horizontal scaling.

> Work in progress. See `docs/` for the PRD, system design and API specification.

## Local development

```bash
docker compose up -d          # MongoDB (replica set) + Redis
cd server && cp .env.example .env && npm install && npm run dev
cd client && npm install && npm run dev
```

API: http://localhost:4000 - Web: http://localhost:5173
