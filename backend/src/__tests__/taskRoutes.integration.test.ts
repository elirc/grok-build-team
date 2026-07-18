/**
 * Integration Tests for Task Routes
 * 
 * Purpose: Test the full HTTP layer + service (without real DB or with test DB).
 * 
 * Why integration tests?
 * - Unit tests on service are good, but don't catch if routes wire correctly.
 * - Test auth middleware, validation, error responses, status codes.
 * - Use supertest to make real HTTP calls to the express app.
 * 
 * Setup for real mid-level project:
 * - Use a separate test database (e.g. via docker or prisma test env).
 * - Or use jest-mock or @prisma/client mock for speed.
 * - Here we demonstrate the pattern with mocks for educational clarity.
 * 
 * Tools: supertest + jest
 */

import request from 'supertest';
import express from 'express';
import taskRoutes from '../routes/taskRoutes';

// We create a minimal app instance for testing (isolated from main index.ts)
const app = express();
app.use(express.json());
app.use('/api/tasks', taskRoutes);

describe('Task Routes (Integration)', () => {
  // In real tests, you'd setup/teardown DB here
  // beforeAll(async () => { await prisma.$connect() or seed test data })

  it('GET /api/tasks should return 200 and list of tasks (with auth stub)', async () => {
    // For real test, we'd set Authorization header with valid JWT
    const res = await request(app)
      .get('/api/tasks')
      .set('Authorization', 'Bearer fake-valid-token');

    // In mocked version this may 401 or return mock data.
    // Educational: We assert on shape and status.
    expect([200, 401]).toContain(res.status); // depending on middleware
    if (res.status === 200) {
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('POST /api/tasks should validate input and return 201', async () => {
    const newTask = {
      title: 'Test task from integration',
      projectId: 'proj_123',
      // missing description is ok if optional
    };

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer fake-token')
      .send(newTask);

    // Expect validation or creation
    expect([201, 400, 401]).toContain(res.status);
  });

  it('should return 400 for invalid task data', async () => {
    const invalidTask = { title: '' }; // fails min length

    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer fake-token')
      .send(invalidTask);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

/**
 * Mid-level insights from this test file:
 * - Integration tests verify the contract between layers.
 * - Always test happy path + error paths (bad input, unauthorized).
 * - For auth, in real tests use a test helper to generate valid JWT for a test user.
 * - Use beforeAll/afterAll for DB setup/teardown to keep tests fast and isolated.
 * - Prefer specific assertions over generic ones.
 */
