import { useState, useEffect, useCallback } from 'react';
import { REFRESH_INTERVAL } from '@/lib/constants';
import { apiGet, apiPost, apiPatch } from '@/lib/fetch';

export function useTasks({ showArchived = false, filterProject = '', filterTag = '' } = {}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async () => {
    try {
      let url = `/api/tasks?archived=${showArchived}`;
      if (filterProject) url += `&project=${encodeURIComponent(filterProject)}`;
      if (filterTag) url += `&tags=${encodeURIComponent(filterTag)}`;
      const data = await apiGet(url);
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
      await apiPost(`/api/tasks/${taskId}/move`, { status });
      await fetchTasks();
    } catch (err) { console.error('Failed to move task:', err); }
  }, [fetchTasks]);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      await apiPatch(`/api/tasks/${taskId}`, updates);
      await fetchTasks();
    } catch (err) { console.error('Failed to update task:', err); }
  }, [fetchTasks]);

  const archiveTask = useCallback(async (taskId) => {
    try {
      await apiPost(`/api/tasks/${taskId}/archive`, {});
      await fetchTasks();
    } catch (err) { console.error('Failed to archive task:', err); }
  }, [fetchTasks]);

  const bulkArchive = useCallback(async (ids) => {
    try {
      await apiPost('/api/tasks/bulk/archive', { ids });
      await fetchTasks();
    } catch (err) { console.error('Failed to bulk archive:', err); }
  }, [fetchTasks]);

  const bulkMove = useCallback(async (ids, status) => {
    try {
      await apiPost('/api/tasks/bulk/move', { ids, status });
      await fetchTasks();
    } catch (err) { console.error('Failed to bulk move:', err); }
  }, [fetchTasks]);

  const bulkAssign = useCallback(async (ids, agent_id) => {
    try {
      await apiPost('/api/tasks/bulk/assign', { ids, agent_id });
      await fetchTasks();
    } catch (err) { console.error('Failed to bulk assign:', err); }
  }, [fetchTasks]);

  return { tasks, loading, error, refresh: fetchTasks, moveTask, updateTask, archiveTask, bulkArchive, bulkMove, bulkAssign };
}

export function useTask(taskId) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTask = useCallback(async () => {
    if (!taskId) { setTask(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiGet(`/api/tasks/${taskId}`);
      setTask(data);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [taskId]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  const addTime = useCallback(async (minutes) => {
    if (!taskId || minutes <= 0) return;
    await apiPost(`/api/tasks/${taskId}/time`, { minutes });
    await fetchTask();
  }, [taskId, fetchTask]);

  const addTokens = useCallback(async (tokens) => {
    if (!taskId || tokens <= 0) return;
    await apiPost(`/api/tasks/${taskId}/tokens`, { tokens });
    await fetchTask();
  }, [taskId, fetchTask]);

  const addComment = useCallback(async (agentId, content) => {
    if (!taskId || !content.trim()) return;
    await apiPost(`/api/tasks/${taskId}/comments`, { agent_id: agentId, content });
    await fetchTask();
  }, [taskId, fetchTask]);

  return { task, loading, error, refresh: fetchTask, addTime, addTokens, addComment };
}

export function useTaskSearch() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query) => {
    if (!query || query.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const data = await apiGet(`/api/search?q=${encodeURIComponent(query)}&include_archived=true`);
      setResults(data);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const clearResults = useCallback(() => setResults(null), []);
  return { results, loading, search, clearResults };
}
