export type Role = "OWNER" | "ADMIN" | "MEMBER";
export type Membership = {
  role: Role;
  organization: { id: string; name: string };
};
export type User = {
  id: string;
  email: string;
  name: string;
  memberships: Membership[];
};
export type Project = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
};
export type Task = {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string;
  dueDate: string | null;
  assigneeId: string | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  version: number;
};
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
export type Audit = {
  id: string;
  action: string;
  version: number;
  createdAt: string;
};
export type Session = { token: string; user: User };
export type Scope = { token: string; organizationId: string };
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  scope: Scope | null,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController(),
    external = options.signal;
  const abort = () => controller.abort();
  external?.addEventListener("abort", abort, { once: true });
  if (external?.aborted) controller.abort();
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error(
          "The request timed out and may already have completed. Refresh current records before retrying.",
        ),
      ),
    15000,
  );
  try {
    const response = await fetch("/api" + path, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        ...(scope
          ? {
              Authorization: "Bearer " + scope.token,
              "x-org-id": scope.organizationId,
            }
          : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        "The service returned an unreadable response. Keep your draft and refresh before retrying.",
        response.status,
      );
    }
    if (!response.ok)
      throw new ApiError(
        data.error || "The request could not be completed.",
        response.status,
      );
    return data as T;
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}
export const fetchProjects = (
  scope: Scope,
  q: string,
  page: number,
  signal?: AbortSignal,
) =>
  request<Page<Project>>(
    "/projects?" + new URLSearchParams({ q, page: String(page) }),
    scope,
    { signal },
  );
export function exportDraft(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type Member = { id: string; name: string; email: string; role: Role };
export type TaskComment = {
  id: string;
  taskId: string;
  organizationId: string;
  authorId: string;
  content: string;
  version: number;
  createdAt: string;
  author: { id: string; name: string };
};
