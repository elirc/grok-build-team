// =============================================================================
// APP.TSX - Root Application Component
// =============================================================================
// This is the top-level component that sets up routing and global providers.
//
// EDUCATIONAL NOTES:
// - We use React Router for client-side navigation
// - TanStack Query (QueryClientProvider) is wrapped at the top so all components can use it
// - This is a common pattern in modern React applications
//
// In a more advanced setup we would also add:
// - Auth context/provider
// - Global error boundary
// - Toast notification system
// =============================================================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TasksPage } from './features/tasks/pages/TasksPage';

// Create a QueryClient instance
// This manages all server state (data fetching, caching, mutations)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // How long data is considered fresh before refetching
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b">
            <div className="max-w-6xl mx-auto px-6 py-4">
              <h1 className="text-2xl font-semibold">grokbuildteamproject</h1>
              <p className="text-sm text-gray-500">Educational Project Management Tool</p>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-6 py-8">
            <Routes>
              <Route path="/" element={<TasksPage />} />
              {/* More routes will be added in later phases */}
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
