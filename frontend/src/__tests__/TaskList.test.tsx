/**
 * Component Test for TaskList
 * 
 * Purpose: Demonstrate testing React components in a mid-level way.
 * 
 * Tools used in real projects: Vitest (fast, Vite-native) + @testing-library/react
 *   - Focus on user behavior, not implementation details.
 *   - Use screen queries, userEvent for interactions.
 * 
 * Why this matters for upskilling:
 * - Tests protect against regressions when refactoring.
 * - Good tests describe the intended behavior clearly (they act as docs).
 * - Avoid testing internal state or private methods.
 * 
 * In this educational project we use Vitest + RTL.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskList } from '../features/tasks/components/TaskList';
import { vi } from 'vitest';

describe('TaskList', () => {
  const mockTasks = [
    { id: '1', title: 'Finish report', status: 'TODO' },
    { id: '2', title: 'Review PR', status: 'IN_PROGRESS' },
  ];

  it('renders list of tasks', () => {
    render(<TaskList tasks={mockTasks} />);

    expect(screen.getByText('Finish report')).toBeInTheDocument();
    expect(screen.getByText('Review PR')).toBeInTheDocument();
  });

  it('calls onTaskClick when a task is clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<TaskList tasks={mockTasks} onTaskClick={handleClick} />);

    await user.click(screen.getByText('Finish report'));

    expect(handleClick).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('shows empty state when no tasks', () => {
    render(<TaskList tasks={[]} />);
    expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
  });
});

/**
 * Mid-level testing best practices shown:
 * - Use userEvent for realistic interactions.
 * - Test from the user's perspective (what they see/do).
 * - Mock callbacks with vi.fn() to verify behavior.
 * - Keep tests independent and focused (one behavior per test).
 */
