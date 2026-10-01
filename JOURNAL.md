> Historical starter notes. For implemented behavior, setup and verified limits, read [README](README.md) and the [learning course](astraupskill/README.md).

# SWE Thought Process Journal — grokbuildteamproject

This document captures the thinking process of an experienced software engineer building a realistic team/project management application.

The goal is to help you (the reader) develop better intuition for architecture, trade-offs, and decision-making — skills that separate juniors from mid-level engineers.

---

## High-Level Architecture Decisions

### Why a layered backend architecture?

**Decision**: Routes → Controllers → Services → Repositories

**Reasoning**:
- In a real application, business logic becomes complex quickly.
- If you put all logic directly in route handlers, the code becomes hard to test, hard to reuse, and hard to reason about.
- Separating concerns makes the codebase more maintainable as it grows.

**Why not just "services" only?**
Many juniors stop at "routes + services". Adding an explicit repository layer gives you:
- Clearer data access boundaries
- Easier swapping of data sources (e.g., Prisma → raw SQL → another ORM)
- Better testability (you can mock repositories)

**Trade-off**: More files and slightly more boilerplate initially. Worth it once the app has more than ~10 entities.

### Why Prisma + PostgreSQL?

**Chosen over**:
- Mongoose + MongoDB (easier but loses relational power)
- Raw SQL (too verbose for learning)
- TypeORM (more complex configuration)

**Why Prisma**:
- Excellent TypeScript support and type safety
- Great developer experience (migrations, studio, etc.)
- Forces you to think in relations, which is valuable for mid-level work
- Very popular in modern startups (2024-2026)

**PostgreSQL choice**:
- Industry standard for most serious applications
- Strong consistency
- Excellent support for JSON, full-text search, and complex queries

### Frontend Architecture: Feature-based + TanStack Query

**Decision**: Organize by feature (`features/tasks`, `features/projects`) rather than by type (`components/`, `pages/`).

**Why**:
- As apps grow, feature folders scale much better.
- Related files stay together (a task form, task list, task hooks, task API calls).
- Easier to delete or refactor entire features.

**Why TanStack Query instead of useEffect + useState?**
- Most real applications need caching, background refetching, optimistic updates, and proper loading/error states.
- Manually managing this with useEffect leads to bugs (stale data, race conditions, unnecessary re-renders).
- TanStack Query is the current standard in the React ecosystem for server state.

**State split**:
- Server state → TanStack Query
- Client/UI state → useState, useReducer, or small Zustand stores (avoid global state until truly needed)

---

## Technology Choices & Rationale

### Authentication Strategy
- JWT (not sessions) because it's stateless and works well with APIs + separate frontend.
- Refresh token rotation will be added in later phases.
- Role-based access control (RBAC) at organization level (very common pattern in SaaS).

### Why Zod instead of class-validator or Joi?
- Works great on both backend and frontend.
- Excellent TypeScript inference.
- Very popular in 2025+ TypeScript stacks.

### API Design Principles
- Consistent response shape: `{ data: ..., meta?: ... }` or `{ error: ... }`
- Proper HTTP status codes
- Pagination on every list endpoint (never return all records)
- Filtering and sorting via query parameters (standard REST practice)

---

## Key Architectural Trade-offs Discussed

1. **Thin controllers vs Fat controllers**
   - We keep controllers thin. They should only validate input, call services, and return responses.
   - Business logic belongs in services.

2. **Repository pattern**
   - Some teams skip this with Prisma. We include it for learning purposes.
   - Real-world note: In very small teams, you can sometimes collapse services + repositories. Know when to simplify.

3. **Frontend: Component composition vs Container/Presentational**
   - We favor composition and custom hooks over rigid patterns.
   - Modern React (with hooks + TanStack Query) makes the old container/presentational split less necessary.

4. **Monorepo vs separate repos**
   - For learning, we keep frontend and backend in one folder.
   - In real companies, they are often separate. The communication contract (API) matters most.

---

## Common Junior Mistakes This Project Tries to Prevent

- Putting database queries directly in route handlers
- Using `any` too freely in TypeScript
- Not validating input on the backend ("the frontend already does it")
- Storing everything in global state on the frontend
- Ignoring pagination until the app is slow
- Writing tests only at the end (or never)

---

## How to Use This Journal

1. Read this file completely before diving into code.
2. When you see a decision in the code, come back here to understand the "why".
3. When you build your own features, try to write your own mini-journal entries.

The ability to explain *why* you made a technical decision is one of the biggest differences between a junior and a mid-level engineer.

---

**Remember**: The code in this project has extensive comments. Read the comments. They're more important than the code itself for your learning.
