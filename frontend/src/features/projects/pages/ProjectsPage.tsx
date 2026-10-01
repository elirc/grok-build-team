import { TaskList } from "../../tasks/components/TaskList";
import { AssigneePicker } from "../../tasks/components/AssigneePicker";
import { CommentsPanel } from "../../tasks/components/CommentsPanel";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Audit,
  Membership,
  Page,
  Project,
  Session,
  Task,
  exportDraft,
  fetchProjects,
  request,
} from "../../../api/client";

type ProjectDraft = Pick<Project, "name" | "description">;
type TaskDraft = Pick<
  Task,
  "title" | "status" | "description" | "dueDate" | "assigneeId"
>;
const blankTask = (): TaskDraft => ({
  title: "",
  status: "TODO",
  description: "",
  dueDate: null,
  assigneeId: null,
});
export function ProjectsPage({
  session,
  membership,
  onGuardChange,
}: {
  session: Session;
  membership: Membership;
  onGuardChange: (guard: { dirty: boolean; busy: boolean }) => void;
}) {
  const scope = useMemo(
    () => ({
      token: session.token,
      organizationId: membership.organization.id,
    }),
    [session.token, membership.organization.id],
  );
  const prefix = [session.user.id, scope.organizationId];
  const manager = membership.role !== "MEMBER";
  const cache = useQueryClient(),
    alive = useRef(true),
    busyRef = useRef(false);
  const [commentGuard, setCommentGuard] = useState({
    dirty: false,
    busy: false,
  });
  const [discussionEpoch, setDiscussionEpoch] = useState(0);
  const [operationBusy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const busy = operationBusy || commentGuard.busy;
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  const [project, setProject] = useState<Project | "new" | null>(null),
    [projectDraft, setProjectDraft] = useState<ProjectDraft>({
      name: "",
      description: "",
    }),
    [projectDirty, setProjectDirty] = useState(false);
  const [task, setTask] = useState<Task | "new" | null>(null),
    [taskDraft, setTaskDraft] = useState<TaskDraft>(blankTask),
    [taskDirty, setTaskDirty] = useState(false);
  const [taskSearch, setTaskSearch] = useState(""),
    [taskQuery, setTaskQuery] = useState(""),
    [taskPage, setTaskPage] = useState(1),
    [taskStatus, setTaskStatus] = useState("");
  const projectId = project && project !== "new" ? project.id : "";
  const dirty = projectDirty || taskDirty || commentGuard.dirty;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    onGuardChange({ dirty, busy });
  }, [dirty, busy, onGuardChange]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTaskQuery(taskSearch);
      setTaskPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [taskSearch]);
  const projects = useQuery({
    queryKey: [...prefix, "projects", query, page],
    queryFn: ({ signal }) => fetchProjects(scope, query, page, signal),
  });
  const tasks = useQuery({
    queryKey: [...prefix, "tasks", projectId, taskQuery, taskStatus, taskPage],
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      request<Page<Task>>(
        `/projects/${projectId}/tasks?` +
          new URLSearchParams({
            q: taskQuery,
            status: taskStatus,
            page: String(taskPage),
          }),
        scope,
        { signal },
      ),
  });
  const audit = useQuery({
    queryKey: [...prefix, "audit", projectId],
    enabled: Boolean(projectId),
    queryFn: ({ signal }) =>
      request<{ items: Audit[] }>(`/projects/${projectId}/audit`, scope, {
        signal,
      }),
  });
  useEffect(() => {
    if (
      projects.data &&
      page > Math.max(1, Math.ceil(projects.data.total / 20))
    )
      setPage(Math.max(1, Math.ceil(projects.data.total / 20)));
  }, [projects.data, page]);
  useEffect(() => {
    if (tasks.data && taskPage > Math.max(1, Math.ceil(tasks.data.total / 20)))
      setTaskPage(Math.max(1, Math.ceil(tasks.data.total / 20)));
  }, [tasks.data, taskPage]);
  const mayDiscard = () =>
    !busy &&
    (!dirty ||
      confirm(
        "Discard unsaved project, task, or comment changes? Export the drafts first to keep them.",
      ));
  const mayDiscardTask = () =>
    !busy &&
    (!(taskDirty || commentGuard.dirty) ||
      confirm("Discard unsaved task or comment changes? Export drafts first."));
  async function run(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (problem) {
      if (alive.current)
        setError(
          (problem instanceof Error
            ? problem.message
            : "The operation failed.") +
            " Unsaved editor values remain available.",
        );
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function refresh() {
    await cache.invalidateQueries({ queryKey: prefix });
  }
  function clearTask() {
    setTask(null);
    setTaskDraft(blankTask());
    setCommentGuard({ dirty: false, busy: false });
    setTaskDirty(false);
  }
  function adoptProject(row: Project) {
    setProject(row);
    setProjectDraft({ name: row.name, description: row.description });
    setProjectDirty(false);
  }
  function adoptTask(row: Task) {
    setTask(row);
    setTaskDraft({
      title: row.title,
      status: row.status,
      description: row.description,
      dueDate: row.dueDate,
      assigneeId: row.assigneeId,
    });
    setTaskDirty(false);
  }
  function clearProject() {
    setProject(null);
    setProjectDraft({ name: "", description: "" });
    setProjectDirty(false);
    clearTask();
    setTaskSearch("");
    setTaskQuery("");
    setTaskPage(1);
    setTaskStatus("");
  }
  function chooseProject(id: string) {
    if (!mayDiscard()) return;
    void run(async () => {
      const row = await request<Project>("/projects/" + id, scope);
      if (alive.current) {
        clearProject();
        adoptProject(row);
      }
    });
  }
  function saveProject(event: FormEvent) {
    event.preventDefault();
    if (!project || !manager) return;
    const baseline = project,
      value = { ...projectDraft };
    void run(async () => {
      const row = await request<Project>(
        "/projects" + (baseline === "new" ? "" : "/" + baseline.id),
        scope,
        {
          method: baseline === "new" ? "POST" : "PUT",
          body: JSON.stringify(
            baseline === "new"
              ? value
              : { version: baseline.version, project: value },
          ),
        },
      );
      if (alive.current) {
        adoptProject(row);
        setNotice("Project saved at version " + row.version + ".");
        await refresh();
      }
    });
  }
  function saveTask(event: FormEvent) {
    event.preventDefault();
    if (!task || !projectId) return;
    const baseline = task,
      value = { ...taskDraft },
      parent = projectId;
    void run(async () => {
      const row = await request<Task>(
        `/projects/${parent}/tasks` +
          (baseline === "new" ? "" : "/" + baseline.id),
        scope,
        {
          method: baseline === "new" ? "POST" : "PUT",
          body: JSON.stringify(
            baseline === "new"
              ? value
              : { version: baseline.version, task: value },
          ),
        },
      );
      if (alive.current) {
        adoptTask(row);
        setNotice("Task saved at version " + row.version + ".");
        await refresh();
      }
    });
  }
  const problem = (value: unknown) =>
    value instanceof Error ? value.message : "Unable to load records.";
  return (
    <section className="workspace" aria-label="Projects workspace">
      <div className="workspace-title">
        <div>
          <p className="eyebrow">{membership.organization.name}</p>
          <h2>Projects and next steps</h2>
        </div>
        {manager && (
          <button
            className="primary"
            disabled={busy}
            onClick={() => {
              if (mayDiscard()) {
                clearProject();
                setProject("new");
                setProjectDirty(true);
                setError("");
                setNotice("");
              }
            }}
          >
            New project
          </button>
        )}
      </div>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="message success" role="status">
          {notice}
        </p>
      )}
      <div className="workspace-grid">
        <section className="panel project-library" aria-label="Project library">
          <div className="section-title">
            <h3>Project library</h3>
            <button
              disabled={projects.isFetching}
              onClick={() => void projects.refetch()}
            >
              Refresh projects
            </button>
          </div>
          <label>
            Search projects
            <input
              type="search"
              maxLength={120}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or description"
            />
          </label>
          {projects.isPending && <p role="status">Loading projects...</p>}
          {projects.error && (
            <p className="message error" role="alert">
              {problem(projects.error)}
              {projects.data && " Previously loaded records are still shown."}
            </p>
          )}
          {projects.data && (
            <>
              <p className="muted">
                {projects.data.total}{" "}
                {projects.data.total === 1 ? "project" : "projects"} in this
                organization
              </p>
              <div className="project-cards">
                {projects.data.items.map((row) => (
                  <article className="record" key={row.id}>
                    <span className="badge">
                      {row._count?.tasks || 0} tasks
                    </span>
                    <h4>{row.name}</h4>
                    <p>{row.description || "No description yet."}</p>
                    <button
                      disabled={busy}
                      onClick={() => chooseProject(row.id)}
                    >
                      Open {row.name}
                    </button>
                  </article>
                ))}
                {!projects.data.items.length && (
                  <p>No projects match this search.</p>
                )}
              </div>
              <div className="pagination">
                <button
                  disabled={projects.isFetching || page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous projects
                </button>
                <span>
                  Page {page} of{" "}
                  {Math.max(1, Math.ceil(projects.data.total / 20))}
                </span>
                <button
                  disabled={
                    projects.isFetching || page * 20 >= projects.data.total
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Next projects
                </button>
              </div>
            </>
          )}
        </section>
        <div className="details-stack">
          {!project ? (
            <section className="panel empty-panel">
              <p className="eyebrow">A PLACE FOR THE DETAILS</p>
              <h3>Choose a project to begin</h3>
              <p>
                Review its purpose, capture the next tasks, and keep accepted
                changes separate from work still in progress.
              </p>
              <div className="tip">
                <strong>A useful task has a clear outcome.</strong>
                <p>
                  For example: Show a helpful conflict message when two editors
                  save the same record.
                </p>
              </div>
            </section>
          ) : (
            <>
              <section
                className="panel project-editor"
                aria-label="Project editor"
              >
                <div className="section-title">
                  <h3>{project === "new" ? "New project" : project.name}</h3>
                  <span className="badge">
                    {project === "new" ? "DRAFT" : "Version " + project.version}
                  </span>
                </div>
                <p className="draft-state">
                  {projectDirty
                    ? "Unsaved project changes"
                    : "Showing saved project values"}
                </p>
                <form onSubmit={saveProject}>
                  <fieldset disabled={busy || !manager}>
                    <label>
                      Project name
                      <input
                        required
                        maxLength={120}
                        value={projectDraft.name}
                        onChange={(event) => {
                          setProjectDraft({
                            ...projectDraft,
                            name: event.target.value,
                          });
                          setProjectDirty(true);
                        }}
                      />
                    </label>
                    <label>
                      Project description
                      <textarea
                        rows={5}
                        maxLength={2000}
                        value={projectDraft.description}
                        onChange={(event) => {
                          setProjectDraft({
                            ...projectDraft,
                            description: event.target.value,
                          });
                          setProjectDirty(true);
                        }}
                      />
                    </label>
                  </fieldset>
                  <div className="actions">
                    {manager && (
                      <button className="primary" disabled={busy}>
                        Save project
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        exportDraft("project-draft.json", {
                          organizationId: scope.organizationId,
                          id: project === "new" ? null : project.id,
                          version: project === "new" ? null : project.version,
                          project: projectDraft,
                        })
                      }
                    >
                      Export project draft
                    </button>
                    {project !== "new" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              "Replace the project editor with saved values? Export its draft first.",
                            )
                          )
                            void run(async () => {
                              const row = await request<Project>(
                                "/projects/" + project.id,
                                scope,
                              );
                              if (alive.current) adoptProject(row);
                            });
                        }}
                      >
                        Load current project
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (mayDiscard()) clearProject();
                      }}
                    >
                      Close project
                    </button>
                  </div>
                </form>
                {project !== "new" && (
                  <>
                    <div className="record-actions">
                      <p className="muted">
                        Projects with tasks must have those tasks removed
                        explicitly before deletion.
                      </p>
                      {manager && (
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                "Delete this project permanently? Projects containing tasks cannot be deleted.",
                              )
                            )
                              void run(async () => {
                                await request(
                                  "/projects/" + project.id,
                                  scope,
                                  {
                                    method: "DELETE",
                                    body: JSON.stringify({
                                      version: project.version,
                                    }),
                                  },
                                );
                                if (alive.current) {
                                  clearProject();
                                  setNotice("Project deleted.");
                                  await refresh();
                                }
                              });
                          }}
                        >
                          Delete project
                        </button>
                      )}
                    </div>
                    <h4>Recent project changes</h4>
                    {audit.error && (
                      <p className="message error" role="alert">
                        {problem(audit.error)}
                      </p>
                    )}
                    <ol className="audit">
                      {audit.data?.items.map((entry) => (
                        <li key={entry.id}>
                          {entry.action.toLowerCase()} · version {entry.version}{" "}
                          · {new Date(entry.createdAt).toLocaleString()}
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </section>
              {projectId && (
                <section
                  className="panel task-workspace"
                  aria-label="Project tasks"
                >
                  <div className="section-title">
                    <h3>Project tasks</h3>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => {
                        if (mayDiscardTask()) {
                          setTask("new");
                          setTaskDraft(blankTask());
                          setCommentGuard({ dirty: false, busy: false });
                          setTaskDirty(true);
                        }
                      }}
                    >
                      New task
                    </button>
                  </div>
                  <div className="task-filters">
                    <label>
                      Search tasks
                      <input
                        type="search"
                        maxLength={120}
                        value={taskSearch}
                        onChange={(event) => setTaskSearch(event.target.value)}
                      />
                    </label>
                    <label>
                      Filter task status
                      <select
                        value={taskStatus}
                        onChange={(event) => {
                          setTaskStatus(event.target.value);
                          setTaskPage(1);
                        }}
                      >
                        <option value="">All statuses</option>
                        <option value="TODO">To do</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="DONE">Done</option>
                      </select>
                    </label>
                  </div>
                  {tasks.isPending && <p role="status">Loading tasks...</p>}
                  {tasks.error && (
                    <p className="message error" role="alert">
                      {problem(tasks.error)}
                    </p>
                  )}
                  <button
                    disabled={tasks.isFetching}
                    onClick={() => void tasks.refetch()}
                  >
                    Refresh tasks
                  </button>
                  {tasks.data && (
                    <>
                      <TaskList
                        tasks={tasks.data.items}
                        disabled={busy}
                        onTaskClick={(row) => {
                          if (mayDiscardTask())
                            void run(async () => {
                              const value = await request<Task>(
                                `/projects/${projectId}/tasks/${row.id}`,
                                scope,
                              );
                              if (alive.current) {
                                setCommentGuard({ dirty: false, busy: false });
                                setDiscussionEpoch((value) => value + 1);
                                adoptTask(value);
                              }
                            });
                        }}
                      />
                      {!tasks.data.items.length && (
                        <p>No tasks match these filters.</p>
                      )}
                      <div className="pagination">
                        <button
                          disabled={tasks.isFetching || taskPage <= 1}
                          onClick={() => setTaskPage(taskPage - 1)}
                        >
                          Previous tasks
                        </button>
                        <span>
                          Page {taskPage} of{" "}
                          {Math.max(1, Math.ceil(tasks.data.total / 20))}
                        </span>
                        <button
                          disabled={
                            tasks.isFetching ||
                            taskPage * 20 >= tasks.data.total
                          }
                          onClick={() => setTaskPage(taskPage + 1)}
                        >
                          Next tasks
                        </button>
                      </div>
                    </>
                  )}
                  {task && (
                    <form
                      className="task-editor"
                      aria-label="Task editor"
                      onSubmit={saveTask}
                    >
                      <div className="section-title">
                        <h4>{task === "new" ? "New task" : "Edit task"}</h4>
                        <span className="badge">
                          {task === "new" ? "DRAFT" : "Version " + task.version}
                        </span>
                      </div>
                      <p className="draft-state">
                        {taskDirty
                          ? "Unsaved task changes"
                          : "Showing saved task values"}
                      </p>
                      <fieldset disabled={busy}>
                        <label>
                          Task title
                          <input
                            required
                            maxLength={180}
                            value={taskDraft.title}
                            onChange={(event) => {
                              setTaskDraft({
                                ...taskDraft,
                                title: event.target.value,
                              });
                              setTaskDirty(true);
                            }}
                          />
                        </label>
                        <label>
                          Task status
                          <select
                            aria-label="Task status"
                            value={taskDraft.status}
                            onChange={(event) => {
                              setTaskDraft({
                                ...taskDraft,
                                status: event.target.value as Task["status"],
                              });
                              setTaskDirty(true);
                            }}
                          >
                            <option value="TODO">To do</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="DONE">Done</option>
                          </select>
                        </label>
                        <label>
                          Task description
                          <textarea
                            aria-label="Task description"
                            rows={4}
                            maxLength={2000}
                            value={taskDraft.description}
                            onChange={(event) => {
                              setTaskDraft({
                                ...taskDraft,
                                description: event.target.value,
                              });
                              setTaskDirty(true);
                            }}
                          />
                        </label>
                        <label>
                          Due date
                          <input
                            type="date"
                            min="1970-01-01"
                            max="2100-12-31"
                            value={taskDraft.dueDate || ""}
                            onChange={(event) => {
                              setTaskDraft({
                                ...taskDraft,
                                dueDate: event.target.value || null,
                              });
                              setTaskDirty(true);
                            }}
                          />
                        </label>
                        <AssigneePicker
                          scope={scope}
                          value={taskDraft.assigneeId}
                          disabled={busy}
                          onChange={(assigneeId) => {
                            setTaskDraft({ ...taskDraft, assigneeId });
                            setTaskDirty(true);
                          }}
                        />
                      </fieldset>
                      <div className="actions">
                        <button className="primary" disabled={busy}>
                          Save task
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            exportDraft("task-draft.json", {
                              organizationId: scope.organizationId,
                              projectId,
                              id: task === "new" ? null : task.id,
                              version: task === "new" ? null : task.version,
                              task: taskDraft,
                            })
                          }
                        >
                          Export task draft
                        </button>
                        {task !== "new" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                confirm(
                                  "Replace the task editor with saved values? Export its draft first.",
                                )
                              )
                                void run(async () => {
                                  const row = await request<Task>(
                                    `/projects/${projectId}/tasks/${task.id}`,
                                    scope,
                                  );
                                  if (alive.current) adoptTask(row);
                                });
                            }}
                          >
                            Load current task
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (mayDiscardTask()) clearTask();
                          }}
                        >
                          Close task
                        </button>
                      </div>
                      {task !== "new" && (
                        <button
                          className="danger"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (
                              !commentGuard.busy &&
                              confirm(
                                "Delete this task permanently and discard its unsaved drafts? Tasks with comments require explicit comment removal first.",
                              )
                            )
                              void run(async () => {
                                await request(
                                  `/projects/${projectId}/tasks/${task.id}`,
                                  scope,
                                  {
                                    method: "DELETE",
                                    body: JSON.stringify({
                                      version: task.version,
                                    }),
                                  },
                                );
                                if (alive.current) {
                                  clearTask();
                                  setNotice("Task deleted.");
                                  await refresh();
                                }
                              });
                          }}
                        >
                          Delete task
                        </button>
                      )}
                    </form>
                  )}
                  {task && task !== "new" && (
                    <CommentsPanel
                      key={task.id + ":" + discussionEpoch}
                      scope={scope}
                      projectId={projectId}
                      taskId={task.id}
                      userId={session.user.id}
                      manager={manager}
                      disabled={operationBusy}
                      onGuardChange={setCommentGuard}
                    />
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
