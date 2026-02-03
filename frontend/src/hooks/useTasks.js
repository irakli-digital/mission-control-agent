import { useState, useEffect, useCallback } from 'react';
import { API_BASE, REFRESH_INTERVAL } from '@/lib/constants';

/**
 * Hook for fetching and managing tasks
 */
export function useTasks({ showArchived = false, filterProject = '', filterTag = '' } = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      let url = `${API_BASE}/api/tasks?archived=${showArchived}`;
      if (filterProject) url += `&project=${encodeURIComponent(filterProject)}`;
      if (filterTag) url += `&tags=${encodeURIComponent(filterTag)}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [showArchived, filterProject, filterTag]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const moveTask = useCallback(async (taskId, status) => {
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchTasks();
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  }, [fetchTasks]);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await fetchTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  }, [fetchTasks]);

  const archiveTask = useCallback(async (taskId) => {
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}/archive`, { method: 'POST' });
      await fetchTasks();
    } catch (err) {
      console.error('Failed to archive task:', err);
    }
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refresh: fetchTasks,
    moveTask,
    updateTask,
    archiveTask
  };
}

/**
 * Hook for fetching a single task with details
 */
export function useTask(taskId) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTask = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch task');
      const data = await res.json();
      setTask(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const addTime = useCallback(async (minutes) => {
    if (!taskId || minutes <= 0) return;
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}/time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes }),
      });
      await fetchTask();
    } catch (err) {
      console.error('Failed to add time:', err);
    }
  }, [taskId, fetchTask]);

  const addTokens = useCallback(async (tokens) => {
    if (!taskId || tokens <= 0) return;
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });
      await fetchTask();
    } catch (err) {
      console.error('Failed to add tokens:', err);
    }
  }, [taskId, fetchTask]);

  const addComment = useCallback(async (agentId, content) => {
    if (!taskId || !content.trim()) return;
    try {
      await fetch(`${API_BASE}/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, content }),
      });
      await fetchTask();
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  }, [taskId, fetchTask]);

  return {
    task,
    loading,
    error,
    refresh: fetchTask,
    addTime,
    addTokens,
    addComment
  };
}

/**
 * Hook for task search
 */
export function useTaskSearch() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/search?q=${encodeURIComponent(query)}&include_archived=true`
      );
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => setResults(null), []);

  return { results, loading, search, clearResults };
}
