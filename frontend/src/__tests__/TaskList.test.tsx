import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";
import { request, fetchProjects } from "../api/client";
const member = {
  role: "OWNER" as const,
  organization: { id: "org_a", name: "Cedar" },
};
const session = {
  token: "synthetic-token",
  user: {
    id: "user_a",
    name: "Alex",
    email: "a@example.test",
    memberships: [member],
  },
};
const empty = { items: [], total: 0, page: 1, pageSize: 20 };
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => vi.unstubAllGlobals());
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectsPage
        session={session}
        membership={member}
        onGuardChange={() => {}}
      />
    </QueryClientProvider>,
  );
}
describe("browser API boundary and project interaction", () => {
  it("sends the selected organization header and bearer token", async () => {
    const mock = vi.fn().mockResolvedValue(response(empty));
    vi.stubGlobal("fetch", mock);
    await fetchProjects(
      { token: "t", organizationId: "org_b" },
      "literal %",
      2,
    );
    expect(mock.mock.calls[0][0]).toContain("q=literal+%25&page=2");
    expect(mock.mock.calls[0][1].headers).toMatchObject({
      "x-org-id": "org_b",
      Authorization: "Bearer t",
    });
  });
  it("rejects failed HTTP responses instead of treating them as lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ error: "Membership removed" }, 403)),
    );
    await expect(
      request("/projects", { token: "t", organizationId: "o" }),
    ).rejects.toThrow("Membership removed");
  });
  it("rejects unreadable successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>wrong</html>")),
    );
    await expect(request("/projects", null)).rejects.toThrow("unreadable");
  });
  it("forwards query cancellation to fetch", async () => {
    const mock = vi.fn().mockImplementation((_url, options) => {
      expect(options.signal.aborted).toBe(true);
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    });
    vi.stubGlobal("fetch", mock);
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchProjects(
        { token: "t", organizationId: "o" },
        "",
        1,
        controller.signal,
      ),
    ).rejects.toThrow("Aborted");
  });
  it("renders empty results with an actionable project editor", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(empty)));
    mount();
    expect(
      await screen.findByText("No projects match this search."),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    expect(screen.getByLabelText("Project name")).toBeVisible();
    expect(screen.getByText("Unsaved project changes")).toBeVisible();
  });
  it("renders a query failure without claiming tenant isolation from empty data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(response({ error: "Database unavailable" }, 503)),
    );
    mount();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Database unavailable",
      ),
    );
    expect(
      screen.queryByText("No projects match this search."),
    ).not.toBeInTheDocument();
  });
});
