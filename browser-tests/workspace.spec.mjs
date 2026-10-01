import jwt from "jsonwebtoken";
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
const api = "http://127.0.0.1:" + process.env.API_PORT;
const password = process.env.DEMO_PASSWORD;
const token = (user = "demo_owner") =>
  jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: "HS256",
    subject: user,
    issuer: "team-workspace",
    audience: "team-workspace-web",
    expiresIn: "30m",
  });
const ownerToken = token();
const headers = (org = "demo_cedar") => ({
  Authorization: "Bearer " + ownerToken,
  "x-org-id": org,
});
async function createProject(request, name) {
  const response = await request.post(api + "/api/projects", {
    headers: headers(),
    data: {
      name,
      description: "A focused space for reliable web application work.",
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}
async function createTask(request, project, title, extra = {}) {
  const response = await request.post(
    `${api}/api/projects/${project.id}/tasks`,
    { headers: headers(), data: { title, status: "TODO", ...extra } },
  );
  expect(response.status()).toBe(201);
  return response.json();
}
async function login(page, email = "owner@example.test") {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Active organization")).toBeVisible();
}
async function openProject(page, name) {
  await page.getByLabel("Search projects", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Open " + name, exact: true }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    name,
  );
}
const accepted = (page, text) =>
  expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();

test("organization changes keep only the selected workspace and tokens stay in memory", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Cedar isolation browser");
  await login(page);
  await openProject(page, project.name);
  await page.getByLabel("Active organization").selectOption("demo_maple");
  await expect(
    page.getByRole("button", { name: "Open Inventory refresh", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open " + project.name, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New project", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
  ).toEqual([0, 0]);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("project CRUD keeps identity and confirms deletion", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Browser CRUD");
  await page
    .getByLabel("Project description")
    .fill("Explain the accepted save boundary.");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await accepted(page, "Project saved at version 1");
  const listing = await request.get(api + "/api/projects?q=Browser%20CRUD", {
    headers: headers(),
  });
  const row = (await listing.json()).items[0];
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Browser CRUD renamed");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await accepted(page, "Project saved at version 2");
  const current = await request.get(api + "/api/projects/" + row.id, {
    headers: headers(),
  });
  expect((await current.json()).name).toBe("Browser CRUD renamed");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Browser CRUD renamed",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await accepted(page, "Project deleted.");
  expect(
    (
      await request.get(api + "/api/projects/" + row.id, { headers: headers() })
    ).status(),
  ).toBe(404);
});

test("members can manage tasks but do not receive project mutation controls", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Member task browser");
  await login(page, "member@example.test");
  await openProject(page, project.name);
  await expect(page.getByLabel("Project name", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save project", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Prepare an API example");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await accepted(page, "Task saved at version 1");
  await page
    .getByRole("combobox", { name: "Task status", exact: true })
    .selectOption("DONE");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await accepted(page, "Task saved at version 2");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "Prepare an API example",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await accepted(page, "Task deleted.");
});

test("two project editors preserve the stale draft and export its baseline", async ({
  page,
  context,
  request,
}) => {
  const project = await createProject(request, "Project conflict browser");
  await login(page);
  await openProject(page, project.name);
  const second = await context.newPage();
  await login(second);
  await openProject(second, project.name);
  await page
    .getByLabel("Project description")
    .fill("Accepted first-editor reasoning");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await accepted(page, "Project saved at version 2");
  await second
    .getByLabel("Project description")
    .fill("Pending second-editor reasoning");
  await second
    .getByRole("button", { name: "Save project", exact: true })
    .click();
  await expect(second.getByRole("alert")).toContainText("record changed");
  await expect(second.getByLabel("Project description")).toHaveValue(
    "Pending second-editor reasoning",
  );
  const downloaded = second.waitForEvent("download");
  await second
    .getByRole("button", { name: "Export project draft", exact: true })
    .click();
  const draft = JSON.parse(
    readFileSync(await (await downloaded).path(), "utf8"),
  );
  expect(draft.version).toBe(1);
  expect(draft.project.description).toBe("Pending second-editor reasoning");
  second.once("dialog", (d) => d.accept());
  await second
    .getByRole("button", { name: "Load current project", exact: true })
    .click();
  await expect(second.getByLabel("Project description")).toHaveValue(
    "Accepted first-editor reasoning",
  );
});

test("two task editors cannot overwrite the accepted task", async ({
  page,
  context,
  request,
}) => {
  const project = await createProject(request, "Task conflict browser"),
    task = await createTask(request, project, "Capture a concurrency trace");
  await login(page);
  await openProject(page, project.name);
  await page
    .getByRole("button", { name: "Edit " + task.title, exact: true })
    .click();
  const second = await context.newPage();
  await login(second);
  await openProject(second, project.name);
  await second
    .getByRole("button", { name: "Edit " + task.title, exact: true })
    .click();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Accepted task title");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await accepted(page, "Task saved at version 2");
  await second
    .getByLabel("Task title", { exact: true })
    .fill("Pending task title");
  await second.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(second.getByRole("alert")).toContainText("record changed");
  await expect(second.getByLabel("Task title", { exact: true })).toHaveValue(
    "Pending task title",
  );
  const exported = second.waitForEvent("download");
  await second
    .getByRole("button", { name: "Export task draft", exact: true })
    .click();
  expect(
    JSON.parse(readFileSync(await (await exported).path(), "utf8")).version,
  ).toBe(1);
  second.once("dialog", (d) => d.accept());
  await second
    .getByRole("button", { name: "Load current task", exact: true })
    .click();
  await expect(second.getByLabel("Task title", { exact: true })).toHaveValue(
    "Accepted task title",
  );
});

test("tenant switching and sign-out require explicit draft discard", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Dirty transition browser");
  await login(page);
  await openProject(page, project.name);
  await page.getByLabel("Project description").fill("Unsaved private draft");
  page.once("dialog", (d) => d.dismiss());
  await page.getByLabel("Active organization").selectOption("demo_maple");
  await expect(page.getByLabel("Active organization")).toHaveValue(
    "demo_cedar",
  );
  await expect(page.getByLabel("Project description")).toHaveValue(
    "Unsaved private draft",
  );
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByLabel("Project description")).toHaveValue(
    "Unsaved private draft",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unsaved private draft", { exact: true }),
  ).toHaveCount(0);
});

test("failed saves preserve input and successful saves remain accepted after refresh failure", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Failure handling browser");
  await login(page);
  await openProject(page, project.name);
  await page.route("**/api/projects/" + project.id, async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        json: { error: "Synthetic write outage" },
      });
    else await route.continue();
  });
  await page.getByLabel("Project description").fill("Keep this input");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Synthetic write outage");
  await expect(page.getByLabel("Project description")).toHaveValue(
    "Keep this input",
  );
  await page.unroute("**/api/projects/" + project.id);
  await page.route("**/api/projects?*", (route) =>
    route.fulfill({ status: 503, json: { error: "Synthetic list outage" } }),
  );
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await accepted(page, "Project saved at version 2");
  await expect(page.getByRole("alert")).toContainText("Synthetic list outage");
  await expect(
    page.getByText("Showing saved project values", { exact: true }),
  ).toBeVisible();
});

test("project deletion with tasks explains the required explicit cleanup", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Referenced deletion browser");
  await createTask(request, project, "Keep this task");
  await login(page);
  await openProject(page, project.name);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Delete the project tasks explicitly",
  );
  await expect(
    page.getByRole("button", { name: "Edit Keep this task", exact: true }),
  ).toBeVisible();
});

test("literal project titles and search do not inject HTML", async ({
  page,
  request,
}) => {
  const name = '<img src=x onerror="window.injected=true">';
  await createProject(request, name);
  await login(page);
  await page.getByLabel("Search projects", { exact: true }).fill(name);
  await expect(
    page.getByRole("button", { name: "Open " + name, exact: true }),
  ).toBeVisible();
  expect(await page.locator(".project-library img").count()).toBe(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("desktop and narrow project/task layouts remain readable", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Release readiness");
  await createTask(
    request,
    project,
    "Trace a failed save from the browser to the transaction",
    {
      description:
        "Write a request trace and verify the accepted row after an audit failure.",
      dueDate: "2031-06-15",
      assigneeId: "demo_member",
    },
  );
  await createTask(
    request,
    project,
    "Review tenant boundaries with a second account",
  );
  await login(page);
  await openProject(page, project.name);
  await page
    .getByRole("button", {
      name: "Edit Trace a failed save from the browser to the transaction",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Task title", { exact: true })).toBeVisible();
  await expect(page.locator(".audit li")).toHaveCount(1);
  await page.getByRole("button", { name: "New comment", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Comment text", exact: true })
    .fill(
      "Please include the expected conflict response and the retained draft in the review.",
    );
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await accepted(page, "Comment saved at version 1");
  mkdirSync("astraupskill/images", { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 1200],
    ["narrow", 390, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `astraupskill/images/${name}.png`,
      fullPage: true,
    });
  }
});

async function openTask(page, project, task) {
  await openProject(page, project.name);
  await page
    .getByRole("button", { name: "Edit " + task.title, exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Task discussion", exact: true }),
  ).toBeVisible();
}
async function createComment(request, project, task, user = "demo_member") {
  const response = await request.post(
    `${api}/api/projects/${project.id}/tasks/${task.id}/comments`,
    {
      headers: { ...headers(), Authorization: "Bearer " + token(user) },
      data: { content: "Original review note" },
    },
  );
  expect(response.status()).toBe(201);
  return response.json();
}
test("registration creates an owned empty team and supports its first project", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create a local account", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Browser Newcomer");
  await page.getByLabel("Team name", { exact: true }).fill("Newcomer Studio");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-newcomer@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("synthetic-browser-registration-password");
  await page
    .getByRole("button", { name: "Create account and team", exact: true })
    .click();
  await expect(page.getByLabel("Active organization")).toContainText(
    "Newcomer Studio",
  );
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("First reliable form");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await accepted(page, "Project saved at version 1");
});
test("task details and owned comments support complete explicit CRUD", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Discussion CRUD"),
    task = await createTask(request, project, "Review the task contract");
  await login(page, "member@example.test");
  await openTask(page, project, task);
  await page
    .getByRole("textbox", { name: "Task description", exact: true })
    .fill("Document the accepted fields.");
  await page.getByLabel("Due date", { exact: true }).fill("2032-02-29");
  await page
    .getByRole("combobox", { name: "Assignee", exact: true })
    .selectOption("demo_member");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await accepted(page, "Task saved at version 2");
  const current = await request.get(
    `${api}/api/projects/${project.id}/tasks/${task.id}`,
    { headers: headers() },
  );
  expect(await current.json()).toMatchObject({
    description: "Document the accepted fields.",
    dueDate: "2032-02-29",
    assigneeId: "demo_member",
    version: 2,
  });
  await page.getByRole("button", { name: "New comment", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Comment text", exact: true })
    .fill("First acceptance example");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await accepted(page, "Comment saved at version 1");
  await page
    .getByRole("textbox", { name: "Comment text", exact: true })
    .fill("Revised acceptance example");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await accepted(page, "Comment saved at version 2");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Delete task comments explicitly",
  );
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toHaveValue("Revised acceptance example");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete comment", exact: true })
    .click();
  await accepted(page, "Comment deleted.");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await accepted(page, "Task deleted.");
});
test("administrators review other authors without editing their words", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Comment ownership"),
    task = await createTask(request, project, "Respect authorship");
  await createComment(request, project, task);
  await login(page);
  await openTask(page, project, task);
  await page
    .getByRole("button", { name: "Review comment by Sam Member", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Save comment", exact: true }),
  ).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Moderate: delete comment", exact: true })
    .click();
  await accepted(page, "Comment deleted.");
});
test("competing comment editors retain the losing draft and version", async ({
  page,
  context,
  request,
}) => {
  const project = await createProject(request, "Comment conflicts"),
    task = await createTask(request, project, "Compare saved versions");
  await createComment(request, project, task);
  await login(page, "member@example.test");
  await openTask(page, project, task);
  await page
    .getByRole("button", { name: "Review comment by Sam Member", exact: true })
    .click();
  const second = await context.newPage();
  await login(second, "member@example.test");
  await openTask(second, project, task);
  await second
    .getByRole("button", { name: "Review comment by Sam Member", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Comment text", exact: true })
    .fill("Accepted discussion change");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await accepted(page, "Comment saved at version 2");
  await second
    .getByRole("textbox", { name: "Comment text", exact: true })
    .fill("Keep my pending discussion");
  await second
    .getByRole("button", { name: "Save comment", exact: true })
    .click();
  await expect(second.getByRole("alert")).toContainText("comment changed");
  await expect(
    second.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toHaveValue("Keep my pending discussion");
  const download = second.waitForEvent("download");
  await second
    .getByRole("button", { name: "Export comment draft", exact: true })
    .click();
  const draft = JSON.parse(readFileSync(await (await download).path(), "utf8"));
  expect(draft.version).toBe(1);
  expect(draft.comment.content).toBe("Keep my pending discussion");
  second.once("dialog", (d) => d.accept());
  await second
    .getByRole("button", { name: "Load current comment", exact: true })
    .click();
  await expect(
    second.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toHaveValue("Accepted discussion change");
});
test("comment failures retain input and refresh failure preserves an accepted save", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Comment failure recovery"),
    task = await createTask(request, project, "Recover a pending note");
  await createComment(request, project, task, "demo_owner");
  await login(page);
  await openTask(page, project, task);
  await page
    .getByRole("button", { name: "Review comment by Alex Owner", exact: true })
    .click();
  await page.route("**/api/projects/**/comments/**", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Synthetic comment save failure" }),
      });
    else await route.continue();
  });
  await page
    .getByRole("textbox", { name: "Comment text", exact: true })
    .fill("Keep the pending explanation");
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic comment save failure",
  );
  await expect(
    page.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toHaveValue("Keep the pending explanation");
  await page.unroute("**/api/projects/**/comments/**");
  await page.route("**/api/projects/**/comments?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Synthetic discussion refresh failure" }),
    }),
  );
  await page.getByRole("button", { name: "Save comment", exact: true }).click();
  await accepted(page, "Comment saved at version 2");
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic discussion refresh failure",
  );
});
test("pending comments participate in task and organization navigation guards", async ({
  page,
  request,
}) => {
  const project = await createProject(request, "Comment navigation"),
    task = await createTask(request, project, "Keep comment drafts");
  await login(page);
  await openTask(page, project, task);
  await page.getByRole("button", { name: "New comment", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Comment text", exact: true })
    .fill("Unsaved discussion detail");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "New task", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toHaveValue("Unsaved discussion detail");
  page.once("dialog", (d) => d.dismiss());
  await page.getByLabel("Active organization").selectOption("demo_maple");
  await expect(
    page.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toHaveValue("Unsaved discussion detail");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Comment text", exact: true }),
  ).toHaveValue("Unsaved discussion detail");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Close task", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Task discussion", exact: true }),
  ).toHaveCount(0);
});
