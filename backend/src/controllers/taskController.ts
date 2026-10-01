import { Request, Response } from "express";
import * as service from "../services/taskService";
import { requireTenant } from "../middleware/tenantContext";
export async function getTasks(req: Request, res: Response) {
  res.json(
    await service.listTasks(requireTenant(req), req.params.id, req.query),
  );
}
export async function createTask(req: Request, res: Response) {
  const row = await service.createTask(
    requireTenant(req),
    req.params.id,
    req.body,
  );
  res
    .location(`/api/projects/${req.params.id}/tasks/${row.id}`)
    .status(201)
    .json(row);
}
