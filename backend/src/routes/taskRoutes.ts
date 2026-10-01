import { Router } from "express";
import * as controller from "../controllers/taskController";
import * as service from "../services/taskService";
import * as comments from "../services/commentService";
import { asyncRoute } from "../lib/errors";
import { requireTenant } from "../middleware/tenantContext";
const router = Router({ mergeParams: true });
router.get("/", asyncRoute(controller.getTasks));
router.post("/", asyncRoute(controller.createTask));
router.get(
  "/:taskId",
  asyncRoute(async (req, res) =>
    res.json(
      await service.getTask(
        requireTenant(req),
        req.params.id,
        req.params.taskId,
      ),
    ),
  ),
);
router.put(
  "/:taskId",
  asyncRoute(async (req, res) =>
    res.json(
      await service.updateTask(
        requireTenant(req),
        req.params.id,
        req.params.taskId,
        req.body,
      ),
    ),
  ),
);
router.delete(
  "/:taskId",
  asyncRoute(async (req, res) =>
    res.json(
      await service.deleteTask(
        requireTenant(req),
        req.params.id,
        req.params.taskId,
        req.body,
      ),
    ),
  ),
);
router.get(
  "/:taskId/audit",
  asyncRoute(async (req, res) => {
    await service.getTask(requireTenant(req), req.params.id, req.params.taskId);
    res.json({
      items: await service.history(
        requireTenant(req),
        "TASK",
        req.params.taskId,
      ),
    });
  }),
);
router.get(
  "/:taskId/comments",
  asyncRoute(async (req, res) =>
    res.json(
      await comments.list(
        requireTenant(req),
        req.params.id,
        req.params.taskId,
        req.query,
      ),
    ),
  ),
);
router.post(
  "/:taskId/comments",
  asyncRoute(async (req, res) => {
    const row = await comments.create(
      requireTenant(req),
      req.params.id,
      req.params.taskId,
      req.body,
    );
    res
      .location(
        `/api/projects/${req.params.id}/tasks/${req.params.taskId}/comments/${row.id}`,
      )
      .status(201)
      .json(row);
  }),
);
router.get(
  "/:taskId/comments/:commentId",
  asyncRoute(async (req, res) =>
    res.json(
      await comments.get(
        requireTenant(req),
        req.params.id,
        req.params.taskId,
        req.params.commentId,
      ),
    ),
  ),
);
router.put(
  "/:taskId/comments/:commentId",
  asyncRoute(async (req, res) =>
    res.json(
      await comments.update(
        requireTenant(req),
        req.params.id,
        req.params.taskId,
        req.params.commentId,
        req.body,
      ),
    ),
  ),
);
router.delete(
  "/:taskId/comments/:commentId",
  asyncRoute(async (req, res) =>
    res.json(
      await comments.remove(
        requireTenant(req),
        req.params.id,
        req.params.taskId,
        req.params.commentId,
        req.body,
      ),
    ),
  ),
);
export default router;
