> Historical starter notes. For implemented behavior, setup and verified limits, read [README](README.md) and the [learning course](astraupskill/README.md).



## Expanded Testing Examples (Added for Deeper Practice)

### Backend Testing Examples

We now have concrete examples in `backend/src/__tests__/`:

1. **authService.test.ts** (Unit test)
   - Mocks bcrypt and jwt
   - Tests password hashing flow and token generation
   - Shows how to isolate pure business logic

2. **taskRoutes.integration.test.ts** (Integration test)
   - Uses supertest to call Express routes directly
   - Verifies status codes, response shapes, validation
   - Includes notes on how to set up test DB vs mocks

### Frontend Testing Examples

1. **TaskList.test.tsx**
   - Uses @testing-library/react + userEvent
   - Tests rendering and user interactions (clicks)
   - Demonstrates good practice: test behavior, not implementation

### How to Run Tests

```bash
# Backend
cd backend
npm install
npm test                 # run once
npm run test:watch       # watch mode
npm run test:coverage    # with coverage report

# Frontend
cd frontend
npm install
npm test
```

### Recommended Testing Pyramid for This Project

- 70% Unit (services, utils, hooks)
- 20% Integration (API routes + DB interactions)
- 10% E2E (critical user flows like login + create task + update status)

### Additional Testing Ideas to Implement

1. Test that a non-member cannot access another org's tasks (authorization test)
2. Test optimistic update behavior in TanStack Query after creating a task
3. Test pagination parameters are passed correctly to the API
4. Add MSW to mock API in frontend tests for isolated component testing
5. Test error states (network failure, validation errors) in both UI and API

Add these as you progress through the phases. Write the test first when possible (TDD style) for the critical paths.

This expanded testing section gives you concrete, runnable examples you can study and extend.
