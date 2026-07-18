// =============================================================================
// API CLIENT
// =============================================================================
// This file is responsible for all communication with our backend API.
//
// Why have a dedicated API layer?
// - All HTTP logic lives in one place (easy to change base URL, add auth headers, logging, etc.)
// - Components don't need to know about fetch or axios
// - Makes testing much easier (we can mock this layer)
// - Consistent error handling
//
// In a real mid-level project you would also add:
// - Request/response interceptors
// - Automatic token refresh logic
// - Better error typing
// =============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

interface RequestOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...fetchOptions.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// AUTH API
// =============================================================================
export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiFetch<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    apiFetch<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// =============================================================================
// TASKS API
// =============================================================================
export const tasksApi = {
  getAll: (token: string) =>
    apiFetch<{ data: any[] }>('/tasks', { token }),

  create: (data: any, token: string) =>
    apiFetch<{ data: any }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),
};
