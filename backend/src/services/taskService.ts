// =============================================================================
// TASK SERVICE
// =============================================================================
// This is where the actual business logic for tasks lives.
//
// IMPORTANT ARCHITECTURE NOTE:
// - This service does NOT know about HTTP (no req/res objects)
// - It only deals with business rules and data access
// - This makes it much easier to test and reuse
//
// In later phases this service will become more complex as we add:
// - Authorization checks (does this user belong to the org?)
// - Business rules (can you move a task to Done if it has no description?)
// - Activity logging
// =============================================================================

import * as taskRepository from '../repositories/taskRepository';

export async function getTasksForProject(projectId: string) {
  // Currently this is a thin wrapper. As complexity grows, business logic will live here.
  return taskRepository.findByProjectId(projectId);
}

export async function createTask(data: {
  title: string;
  description?: string;
  projectId: string;
  assigneeId?: string;
}) {
  // Validation and business rules would go here in a real implementation
  return taskRepository.create(data);
}
