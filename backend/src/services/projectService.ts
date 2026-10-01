import * as repo from "../repositories/projectRepository";
import { TenantContext, requireManager } from "../middleware/tenantContext";
import {
  projectInput,
  projectUpdate,
  taskInput,
  taskUpdate,
  deleteInput,
  listInput,
  taskListInput,
  identity,
} from "../lib/validation";

export const getProjectsForOrganization = (
  context: TenantContext,
  query: unknown,
) => repo.findByOrganizationId(context.organizationId, listInput.parse(query));
export const getProject = (context: TenantContext, id: unknown) =>
  repo.getProject(context.organizationId, identity.parse(id));
export function createProject(context: TenantContext, value: unknown) {
  requireManager(context);
  return repo.create(context, projectInput.parse(value));
}
export function updateProject(
  context: TenantContext,
  id: unknown,
  value: unknown,
) {
  requireManager(context);
  const data = projectUpdate.parse(value);
  return repo.update(context, identity.parse(id), data.version, data.project);
}
export function deleteProject(
  context: TenantContext,
  id: unknown,
  value: unknown,
) {
  requireManager(context);
  return repo.remove(
    context,
    identity.parse(id),
    deleteInput.parse(value).version,
  );
}
export const listTasks = (
  context: TenantContext,
  projectId: unknown,
  query: unknown,
) =>
  repo.listTasks(
    context.organizationId,
    identity.parse(projectId),
    taskListInput.parse(query),
  );
export const getTask = (
  context: TenantContext,
  projectId: unknown,
  id: unknown,
) =>
  repo.getTask(
    context.organizationId,
    identity.parse(projectId),
    identity.parse(id),
  );
export const createTask = (
  context: TenantContext,
  projectId: unknown,
  value: unknown,
) =>
  repo.createTask(context, identity.parse(projectId), taskInput.parse(value));
export function updateTask(
  context: TenantContext,
  projectId: unknown,
  id: unknown,
  value: unknown,
) {
  const data = taskUpdate.parse(value);
  return repo.updateTask(
    context,
    identity.parse(projectId),
    identity.parse(id),
    data.version,
    data.task,
  );
}
export const deleteTask = (
  context: TenantContext,
  projectId: unknown,
  id: unknown,
  value: unknown,
) =>
  repo.removeTask(
    context,
    identity.parse(projectId),
    identity.parse(id),
    deleteInput.parse(value).version,
  );
export const history = (
  context: TenantContext,
  kind: "PROJECT" | "TASK",
  id: unknown,
) => repo.history(context.organizationId, kind, identity.parse(id));
