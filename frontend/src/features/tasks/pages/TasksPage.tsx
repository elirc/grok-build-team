// =============================================================================
// TASKS PAGE - Main Tasks View
// =============================================================================
// This component demonstrates several important React + API patterns.
//
// KEY LEARNING POINTS:
// 1. We use TanStack Query (useQuery) instead of useEffect + useState for data fetching.
//    This gives us automatic caching, loading states, error handling, and refetching.
//
// 2. The component stays focused on UI. All data logic lives in the API layer.
//
// 3. We're preparing for future features (organization context, filters, etc.)
//    by keeping the structure clean.
//
// In later phases we will add:
// - Filtering and search
// - Pagination
// - Real-time updates
// - Optimistic UI updates
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../../../api/client';
import { TaskList } from '../components/TaskList';

export function TasksPage() {
  // useQuery automatically handles:
  // - Loading state (isLoading)
  // - Error state (isError)
  // - Caching the result
  // - Background refetching
  const { data, isLoading, error } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.getAll(''), // TODO: pass real auth token later
  });

  const tasks = data?.data || [];

  if (isLoading) {
    return <div className="p-8">Loading tasks...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Failed to load tasks</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold">Tasks</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          New Task
        </button>
      </div>

      <TaskList 
        tasks={tasks} 
        onTaskClick={(task) => console.log('Task clicked (demo):', task)} 
      />

      <div className="mt-8 text-sm text-gray-500 border-t pt-4">
        <p><strong>Note for learning:</strong> This page will evolve significantly. 
        Watch how we improve data fetching, add filtering, real-time updates, and proper loading states in future phases.</p>
      </div>
    </div>
  );
}
