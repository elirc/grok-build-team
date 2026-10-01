import { Membership } from "../../../api/client";
export function OrganizationsPage({
  memberships,
  current,
  disabled,
  onChange,
}: {
  memberships: Membership[];
  current: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const selected = memberships.find((m) => m.organization.id === current);
  return (
    <section className="organization-bar" aria-label="Organization selection">
      <label>
        Active organization
        <select
          aria-label="Active organization"
          value={current}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {memberships.map((member) => (
            <option key={member.organization.id} value={member.organization.id}>
              {member.organization.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <span className="badge">{selected?.role || "NO MEMBERSHIP"}</span>
        <p>
          {selected?.role === "MEMBER"
            ? "You can review projects and manage their tasks."
            : "You can manage projects and their tasks."}
        </p>
      </div>
    </section>
  );
}
