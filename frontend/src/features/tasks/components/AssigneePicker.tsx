import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Member, Page, Scope, request } from "../../../api/client";
export function AssigneePicker({
  scope,
  value,
  disabled,
  onChange,
}: {
  scope: Scope;
  value: string | null;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [search]);
  const members = useQuery({
    queryKey: [scope.organizationId, "member-options", query, page],
    queryFn: ({ signal }) =>
      request<Page<Member>>(
        "/members?" + new URLSearchParams({ q: query, page: String(page) }),
        scope,
        { signal },
      ),
  });
  const selected = useQuery({
    queryKey: [scope.organizationId, "member-option", value],
    enabled: !!value,
    queryFn: ({ signal }) =>
      request<Member>("/members/" + value, scope, { signal }),
  });
  useEffect(() => {
    if (members.data && page > Math.max(1, Math.ceil(members.data.total / 20)))
      setPage(Math.max(1, Math.ceil(members.data.total / 20)));
  }, [members.data, page]);
  const currentMissing =
    value && !members.data?.items.some((member) => member.id === value);
  return (
    <div className="assignee-picker">
      <label>
        Search team members
        <input
          type="search"
          maxLength={120}
          disabled={disabled}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label>
        Assignee
        <select
          aria-label="Assignee"
          disabled={disabled}
          value={value || ""}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Unassigned</option>
          {currentMissing && (
            <option value={value}>
              {selected.data
                ? `${selected.data.name} (${selected.data.email})`
                : "Current assignment - details unavailable"}
            </option>
          )}
          {members.data?.items.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} ({member.email})
            </option>
          ))}
        </select>
      </label>
      {members.isPending && <p role="status">Loading team members...</p>}
      {(members.error || selected.error) && (
        <p role="alert" className="message error">
          {(members.error || selected.error)?.message} The current assignment
          remains selected.
        </p>
      )}
      <div className="pagination">
        <button
          type="button"
          disabled={disabled || members.isFetching || page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous members
        </button>
        <span>
          Member page {page} of{" "}
          {Math.max(1, Math.ceil((members.data?.total || 0) / 20))}
        </span>
        <button
          type="button"
          disabled={
            disabled ||
            members.isFetching ||
            !members.data ||
            page * 20 >= members.data.total
          }
          onClick={() => setPage(page + 1)}
        >
          Next members
        </button>
      </div>
    </div>
  );
}
