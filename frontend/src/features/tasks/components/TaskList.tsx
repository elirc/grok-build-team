import { Task } from "../../../api/client";
export function TaskList({
  tasks,
  disabled,
  onTaskClick,
}: {
  tasks: Task[];
  disabled: boolean;
  onTaskClick: (task: Task) => void;
}) {
  return (
    <ul className="task-list">
      {tasks.map((row) => (
        <li key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <span className="status">
              {row.status.replaceAll("_", " ").toLowerCase()}
            </span>
            {row.dueDate && <small>Due {row.dueDate}</small>}
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTaskClick(row)}
          >
            Edit {row.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
