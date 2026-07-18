// =============================================================================
// TASK ROUTES
// =============================================================================
// These are the HTTP endpoints for task operations.
//
// Notice how thin these routes are. They mostly:
// 1. Validate input
// 2. Call the controller (or service directly in simple cases)
// 3. Return an appropriate response
//
// This is intentional. A mid-level engineer knows that routes should not contain business logic.
//
// TODO in future phases:
// - Add authentication middleware
// - Add authorization checks
// - Add proper pagination
// - Add filtering and sorting
// =============================================================================

import { Router } from 'express';
import { z } from 'zod';
import * as taskController from '../controllers/taskController';

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string(),
  assigneeId: z.string().optional(),
});

// GET /api/tasks?projectId=xxx
router.get('/', taskController.getTasks);

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    createTaskSchema.parse(req.body);
    await taskController.createTask(req, res);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

export default router;
