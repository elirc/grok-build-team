// =============================================================================
// TASK LIST COMPONENT
// =============================================================================
// This is a presentational component focused only on displaying tasks.
//
// Why separate components from pages?
// - Reusability (this list could be used in different contexts)
// - Easier testing
// - Clearer responsibility
//
// In a real mid-level project, this component would receive tasks as props
// and would not know where the data came from.
// =============================================================================

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status?: string;
}

interface TaskListProps {
  tasks: Task[];
  onTaskClick?: (task: Task) => void;
}

export function TaskList({ tasks, onTaskClick }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No tasks found. Create your first task to get started.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          onClick={() => onTaskClick?.(task)}
          className="bg-white border rounded-lg p-4 hover:shadow-sm cursor-pointer transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-medium text-gray-900">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
            {task.status && (
              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                {task.status}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
