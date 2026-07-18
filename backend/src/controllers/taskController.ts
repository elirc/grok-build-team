// =============================================================================
// TASK CONTROLLER (Educational)
// =============================================================================
// In our architecture, controllers act as a thin layer between routes and services.
//
// Some teams combine routes + controllers. We separate them here to make the
// learning experience clearer.
//
// A controller's job is usually:
// - Receive the HTTP request
// - Extract and validate relevant data
// - Call the appropriate service
// - Return an HTTP response
//
// It should NOT contain business logic or direct database access.
// =============================================================================

import { Request, Response } from 'express';
import * as taskService from '../services/taskService';

export async function getTasks(req: Request, res: Response) {
  const { projectId } = req.query;

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'projectId is required' });
  }

  const tasks = await taskService.getTasksForProject(projectId);
  res.json({ data: tasks });
}

export async function createTask(req: Request, res: Response) {
  // In a real implementation we would validate here or in middleware
  const task = await taskService.createTask(req.body);
  res.status(201).json({ data: task });
}
