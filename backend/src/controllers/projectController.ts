import { Request, Response } from "express";
import * as service from "../services/projectService";
import { requireTenant } from "../middleware/tenantContext";

export async function getProjects(req: Request, res: Response) {
  res.json(
    await service.getProjectsForOrganization(requireTenant(req), req.query),
  );
}
export async function createProject(req: Request, res: Response) {
  const row = await service.createProject(requireTenant(req), req.body);
  res
    .location("/api/projects/" + row.id)
    .status(201)
    .json(row);
}
