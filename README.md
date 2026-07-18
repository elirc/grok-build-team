# grokbuildteamproject

A full-stack Team / Project Management application built for educational purposes.

**Goal**: Help a developer upskill from junior to mid-level SWE by building a realistic, non-trivial CRUD application with proper architecture, APIs, React frontend, and testing considerations.

## Tech Stack

**Backend**
- Node.js + TypeScript
- Express.js
- Prisma ORM + PostgreSQL
- Zod for validation
- JWT for authentication

**Frontend**
- React + TypeScript (Vite)
- TanStack Query (for server state)
- React Hook Form + Zod (forms)
- Tailwind CSS
- React Router

**Architecture Focus**
- Layered backend architecture (Routes → Controllers → Services → Repositories)
- Feature-based organization on frontend
- Clear separation of concerns
- Type safety throughout

## Project Philosophy

This project prioritizes **learning** over production readiness:
- Every important file has extensive comments explaining:
  - What the code does
  - Why it was written this way
  - How it interacts with other parts of the system
- Trade-offs are discussed openly
- Common junior mistakes are called out

## Getting Started (For Learning)

1. Read `JOURNAL.md` first — this explains the senior SWE thought process.
2. Read `PHASE_PLANS.md` to see the roadmap.
3. Explore the code with comments as your guide.
4. Try extending features yourself (see PHASE_PLANS for ideas).

## Folder Structure

```
grokbuildteamproject/
├── backend/                 # Express + TypeScript API
│   ├── src/
│   │   ├── controllers/     # Handle HTTP requests
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Data access layer
│   │   ├── routes/          # Route definitions
│   │   ├── middleware/      # Auth, validation, error handling
│   │   └── types/           # Shared TypeScript types
│   └── prisma/              # Prisma schema + migrations
├── frontend/                # React + TypeScript app
│   └── src/
│       ├── features/        # Feature-based folders (tasks, projects, etc.)
│       ├── components/      # Shared UI components
│       ├── hooks/           # Custom React hooks
│       ├── api/             # API client functions
│       └── lib/             # Utilities
├── docker/                  # Docker setup for Postgres
├── JOURNAL.md               # Senior SWE thought process
├── PHASE_PLANS.md           # Detailed roadmap and future features
└── README.md
```

## Next Steps for Learning

See `PHASE_PLANS.md` for a structured way to extend this project.

This project is intentionally **not** meant to be "just run and done". The value comes from reading the comments, understanding the architecture decisions, and experimenting with improvements.
