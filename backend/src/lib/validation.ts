import { z } from "zod";

const text = (max: number, empty = false) =>
  z
    .string()
    .trim()
    .min(empty ? 0 : 1)
    .max(max)
    .refine(
      (value) => !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value),
      "Unsupported control characters",
    );
export const identity = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,64}$/, "Invalid identity");
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T00:00:00.000Z");
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      value >= "1970-01-01" &&
      value <= "2100-12-31"
    );
  }, "Use a real calendar date from 1970 through 2100");
export const projectInput = z
  .object({ name: text(120), description: text(2000, true).default("") })
  .strict();
export const taskInput = z
  .object({
    title: text(180),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
    description: text(2000, true).default(""),
    dueDate: calendarDate.nullable().default(null),
    assigneeId: identity.nullable().default(null),
  })
  .strict();
export const version = z.number().int().min(1).max(2147483646);
export const projectUpdate = z
  .object({ version, project: projectInput })
  .strict();
export const taskUpdate = z.object({ version, task: taskInput }).strict();
export const deleteInput = z.object({ version }).strict();
export const listInput = z
  .object({
    q: text(120, true).default(""),
    page: z
      .string()
      .regex(/^[1-9]\d{0,4}$/)
      .transform(Number)
      .refine((value) => value <= 10000)
      .default("1"),
  })
  .strict();
export const taskListInput = z
  .object({
    q: text(120, true).default(""),
    page: z
      .string()
      .regex(/^[1-9]\d{0,4}$/)
      .transform(Number)
      .refine((value) => value <= 10000)
      .default("1"),
    status: z.enum(["TODO", "IN_PROGRESS", "DONE", ""]).default(""),
  })
  .strict();
export const loginInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z
      .string()
      .min(1)
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password exceeds 72 UTF-8 bytes",
      ),
  })
  .strict();
export type ProjectInput = z.infer<typeof projectInput>;
export type TaskInput = z.infer<typeof taskInput>;
export type ListInput = z.infer<typeof listInput>;
export type TaskListInput = z.infer<typeof taskListInput>;

export const registrationInput = loginInput
  .extend({
    name: text(120),
    teamName: text(120),
    password: loginInput.shape.password.refine(
      (value) => value.length >= 12,
      "Use at least 12 characters",
    ),
  })
  .strict();
export const commentInput = z.object({ content: text(2000) }).strict();
export const commentUpdate = z
  .object({ version, comment: commentInput })
  .strict();
export type CommentInput = z.infer<typeof commentInput>;
