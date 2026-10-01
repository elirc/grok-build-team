import {
  projectInput,
  taskInput,
  projectUpdate,
  taskUpdate,
  listInput,
  taskListInput,
  loginInput,
} from "../lib/validation";
import { requireManager } from "../middleware/tenantContext";
import { validateSecret } from "../middleware/auth";

describe("request values and role policy", () => {
  it("normalizes editable project fields without modifying input", () => {
    const value = { name: " Cedar ", description: " Notes " };
    expect(projectInput.parse(value)).toEqual({
      name: "Cedar",
      description: "Notes",
    });
    expect(value.name).toBe(" Cedar ");
  });
  it("rejects client-controlled tenant and identity fields", () => {
    for (const key of ["organizationId", "id", "version", "createdAt"])
      expect(projectInput.safeParse({ name: "A", [key]: "x" }).success).toBe(
        false,
      );
  });
  it("rejects blank and overlong project names", () => {
    for (const name of ["", " ", "x".repeat(121)])
      expect(projectInput.safeParse({ name }).success).toBe(false);
  });
  it("bounds description and unsupported control characters", () => {
    expect(
      projectInput.safeParse({ name: "A", description: "x".repeat(2001) })
        .success,
    ).toBe(false);
    expect(projectInput.safeParse({ name: "A\u0000" }).success).toBe(false);
  });
  it("requires exact task statuses and task shape", () => {
    for (const status of ["done", "DELETED", null])
      expect(taskInput.safeParse({ title: "A", status }).success).toBe(false);
    expect(
      taskInput.safeParse({ title: "A", status: "TODO", projectId: "x" })
        .success,
    ).toBe(false);
  });
  it("bounds captured versions to database integer range", () => {
    for (const version of [0, -1, 1.2, true, "1", 2147483647]) {
      expect(
        projectUpdate.safeParse({ version, project: { name: "A" } }).success,
      ).toBe(false);
      expect(
        taskUpdate.safeParse({ version, task: { title: "A", status: "TODO" } })
          .success,
      ).toBe(false);
    }
  });
  it("rejects unknown wrapper and repeated query fields", () => {
    expect(
      projectUpdate.safeParse({ version: 1, project: { name: "A" }, extra: 1 })
        .success,
    ).toBe(false);
    expect(listInput.safeParse({ q: ["a", "b"] }).success).toBe(false);
    expect(listInput.safeParse({ extra: "x" }).success).toBe(false);
  });
  it("requires bounded decimal pages", () => {
    for (const page of ["0", "01", "-1", "1e2", "1.5", "10001"])
      expect(listInput.safeParse({ page }).success).toBe(false);
    expect(listInput.parse({})).toEqual({ q: "", page: 1 });
  });
  it("accepts supported task filters", () => {
    expect(taskListInput.parse({ status: "DONE" })).toEqual({
      q: "",
      page: 1,
      status: "DONE",
    });
    expect(taskListInput.safeParse({ status: "unknown" }).success).toBe(false);
  });
  it("normalizes email and enforces bcrypt byte boundary", () => {
    expect(
      loginInput.parse({ email: " OWNER@EXAMPLE.TEST ", password: "pass" })
        .email,
    ).toBe("owner@example.test");
    expect(
      loginInput.safeParse({
        email: "a@example.test",
        password: "\u00e9".repeat(37),
      }).success,
    ).toBe(false);
  });
  it("requires manager roles for project writes", () => {
    expect(() =>
      requireManager({ userId: "u", organizationId: "o", role: "MEMBER" }),
    ).toThrow();
    expect(() =>
      requireManager({ userId: "u", organizationId: "o", role: "ADMIN" }),
    ).not.toThrow();
  });
  it("rejects short and placeholder JWT secrets", () => {
    for (const secret of ["", "a".repeat(20), "replace-with-" + "x".repeat(40)])
      expect(() => validateSecret(secret)).toThrow();
    expect(() =>
      validateSecret("synthetic-test-secret-" + "x".repeat(40)),
    ).not.toThrow();
  });
});
