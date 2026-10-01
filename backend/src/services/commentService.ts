import * as repo from "../repositories/commentRepository";
import {
  identity,
  listInput,
  commentInput,
  commentUpdate,
  deleteInput,
} from "../lib/validation";
import { TenantContext } from "../middleware/tenantContext";
export const list = (c: TenantContext, p: unknown, t: unknown, q: unknown) =>
  repo.list(c, identity.parse(p), identity.parse(t), listInput.parse(q));
export const get = (c: TenantContext, p: unknown, t: unknown, id: unknown) =>
  repo.get(c, identity.parse(p), identity.parse(t), identity.parse(id));
export const create = (
  c: TenantContext,
  p: unknown,
  t: unknown,
  value: unknown,
) =>
  repo.create(
    c,
    identity.parse(p),
    identity.parse(t),
    commentInput.parse(value),
  );
export function update(
  c: TenantContext,
  p: unknown,
  t: unknown,
  id: unknown,
  value: unknown,
) {
  const data = commentUpdate.parse(value);
  return repo.update(
    c,
    identity.parse(p),
    identity.parse(t),
    identity.parse(id),
    data.version,
    data.comment,
  );
}
export const remove = (
  c: TenantContext,
  p: unknown,
  t: unknown,
  id: unknown,
  value: unknown,
) =>
  repo.remove(
    c,
    identity.parse(p),
    identity.parse(t),
    identity.parse(id),
    deleteInput.parse(value).version,
  );
