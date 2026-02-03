const BASE = '/api';

export async function fetchJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

export async function postJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function patchJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const getAgents = () => fetchJSON('/agents');
export const getTasks = (params = '') => fetchJSON(`/tasks${params ? '?' + params : ''}`);
export const getTask = (id) => fetchJSON(`/tasks/${id}`);
export const getActivities = (limit = 30) => fetchJSON(`/activities?limit=${limit}`);
export const getStats = () => fetchJSON('/stats');
export const getStandup = () => fetchJSON('/standup');
export const createTask = (body) => postJSON('/tasks', body);
export const updateTask = (id, body) => patchJSON(`/tasks/${id}`, body);
export const addComment = (taskId, body) => postJSON(`/tasks/${taskId}/comments`, body);
