import { FormEvent, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Audit,
  Page,
  Scope,
  TaskComment,
  request,
  exportDraft,
} from "../../../api/client";
export function CommentsPanel({
  scope,
  projectId,
  taskId,
  userId,
  manager,
  disabled,
  onGuardChange,
}: {
  scope: Scope;
  projectId: string;
  taskId: string;
  userId: string;
  manager: boolean;
  disabled: boolean;
  onGuardChange: (guard: { dirty: boolean; busy: boolean }) => void;
}) {
  const base = `/projects/${projectId}/tasks/${taskId}`,
    prefix = [userId, scope.organizationId, "comments", taskId];
  const cache = useQueryClient(),
    alive = useRef(true),
    busyRef = useRef(false);
  const [selected, setSelected] = useState<TaskComment | "new" | null>(null),
    [content, setContent] = useState(""),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => onGuardChange({ dirty, busy }), [dirty, busy, onGuardChange]);
  const rows = useQuery({
    queryKey: [...prefix, page],
    queryFn: ({ signal }) =>
      request<Page<TaskComment>>(base + "/comments?page=" + page, scope, {
        signal,
      }),
  });
  const history = useQuery({
    queryKey: [userId, scope.organizationId, "task-audit", taskId],
    queryFn: ({ signal }) =>
      request<{ items: Audit[] }>(base + "/audit", scope, { signal }),
  });
  useEffect(() => {
    if (rows.data && page > Math.max(1, Math.ceil(rows.data.total / 20)))
      setPage(Math.max(1, Math.ceil(rows.data.total / 20)));
  }, [rows.data, page]);
  const locked = disabled || busy;
  function clear() {
    setSelected(null);
    setContent("");
    setDirty(false);
  }
  function adopt(row: TaskComment) {
    setSelected(row);
    setContent(row.content);
    setDirty(false);
  }
  const mayDiscard = () =>
    !locked &&
    (!dirty ||
      confirm("Discard unsaved comment changes? Export the draft first."));
  async function run(work: () => Promise<void>) {
    if (busyRef.current || disabled) return;
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
            : "Comment operation failed.") +
            " Your pending comment remains available.",
        );
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const baseline = selected,
      value = { content };
    void run(async () => {
      const row = await request<TaskComment>(
        base + "/comments" + (baseline === "new" ? "" : "/" + baseline.id),
        scope,
        {
          method: baseline === "new" ? "POST" : "PUT",
          body: JSON.stringify(
            baseline === "new"
              ? value
              : { version: baseline.version, comment: value },
          ),
        },
      );
      if (alive.current) {
        adopt(row);
        setNotice("Comment saved at version " + row.version + ".");
        await cache.invalidateQueries({ queryKey: prefix });
      }
    });
  }
  const mayEdit = selected === "new" || selected?.authorId === userId;
  return (
    <section className="discussion" aria-label="Task discussion">
      <div className="section-title">
        <h4>Task discussion</h4>
        <button
          type="button"
          disabled={locked}
          onClick={() => {
            if (mayDiscard()) {
              clear();
              setSelected("new");
              setDirty(true);
              setError("");
              setNotice("");
            }
          }}
        >
          New comment
        </button>
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
      <button
        type="button"
        disabled={rows.isFetching}
        onClick={() => void rows.refetch()}
      >
        Refresh comments
      </button>
      {rows.isPending && <p role="status">Loading comments...</p>}
      {rows.error && (
        <p className="message error" role="alert">
          {rows.error.message}
          {rows.data && " Previously loaded comments remain shown."}
        </p>
      )}
      {rows.data && (
        <>
          <p>{rows.data.total} {rows.data.total === 1 ? "comment" : "comments"} in this task</p>
          <ol className="comment-list">
            {rows.data.items.map((row) => (
              <li key={row.id}>
                <strong>{row.author.name}</strong>
                <p className="comment-content">{row.content}</p>
                <small>Version {row.version}</small>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (mayDiscard())
                      void run(async () => {
                        const current = await request<TaskComment>(
                          base + "/comments/" + row.id,
                          scope,
                        );
                        if (alive.current) adopt(current);
                      });
                  }}
                >
                  Review comment by {row.author.name}
                </button>
              </li>
            ))}
          </ol>
          <div className="pagination">
            <button
              type="button"
              disabled={rows.isFetching || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous comments
            </button>
            <span>
              Page {page} of {Math.max(1, Math.ceil(rows.data.total / 20))}
            </span>
            <button
              type="button"
              disabled={rows.isFetching || page * 20 >= rows.data.total}
              onClick={() => setPage(page + 1)}
            >
              Next comments
            </button>
          </div>
        </>
      )}
      {selected && (
        <form aria-label="Comment editor" onSubmit={save}>
          <h4>
            {selected === "new"
              ? "New comment"
              : "Comment by " + selected.author.name}
          </h4>
          <p>
            {dirty ? "Unsaved comment changes" : "Showing saved comment values"}
            {selected !== "new" && " - version " + selected.version}
          </p>
          <label>
            Comment text
            <textarea
              aria-label="Comment text"
              rows={5}
              required
              maxLength={2000}
              disabled={locked || !mayEdit}
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setDirty(true);
              }}
            />
          </label>
          <div className="actions">
            {mayEdit && (
              <button className="primary" disabled={locked}>
                Save comment
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                exportDraft("comment-draft.json", {
                  organizationId: scope.organizationId,
                  projectId,
                  taskId,
                  id: selected === "new" ? null : selected.id,
                  version: selected === "new" ? null : selected.version,
                  comment: { content },
                })
              }
            >
              Export comment draft
            </button>
            {selected !== "new" && (
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  if (
                    confirm(
                      "Replace the comment editor with current saved values? Export your draft first.",
                    )
                  )
                    void run(async () => {
                      const row = await request<TaskComment>(
                        base + "/comments/" + selected.id,
                        scope,
                      );
                      if (alive.current) adopt(row);
                    });
                }}
              >
                Load current comment
              </button>
            )}
            <button
              type="button"
              disabled={locked}
              onClick={() => {
                if (mayDiscard()) {
                  clear();
                  setError("");
                  setNotice("");
                }
              }}
            >
              Close comment
            </button>
          </div>
          {selected !== "new" && (mayEdit || manager) && (
            <button
              className="danger"
              type="button"
              disabled={locked}
              onClick={() => {
                if (
                  confirm(
                    "Delete this saved comment permanently and discard its pending draft?",
                  )
                )
                  void run(async () => {
                    await request(base + "/comments/" + selected.id, scope, {
                      method: "DELETE",
                      body: JSON.stringify({ version: selected.version }),
                    });
                    if (alive.current) {
                      clear();
                      setNotice("Comment deleted.");
                      await cache.invalidateQueries({ queryKey: prefix });
                    }
                  });
              }}
            >
              {mayEdit ? "Delete comment" : "Moderate: delete comment"}
            </button>
          )}
        </form>
      )}
      <h4>Recent task changes</h4>
      {history.error && (
        <p role="alert" className="message error">
          {history.error.message}
        </p>
      )}
      {history.data && (
        <ol>
          {history.data.items.map((row) => (
            <li key={row.id}>
              {row.action.toLowerCase()} - version {row.version}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
