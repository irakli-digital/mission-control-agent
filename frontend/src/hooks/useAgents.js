import { useState, useEffect, useCallback } from 'react';
import { API_BASE, REFRESH_INTERVAL } from '@/lib/constants';

/**
 * Hook for fetching and managing agent data
 */
export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      setAgents(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  return { agents, loading, error, refresh: fetchAgents };
}

/**
 * Hook for fetching a single agent's tasks
 */
export function useAgentTasks(agentName) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentName) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/tasks?agent=${encodeURIComponent(agentName)}&archived=false`
        );
        const data = await res.json();
        setTasks(data);
      } catch (err) {
        console.error('Failed to fetch agent tasks:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [agentName]);

  return { tasks, loading };
}

/**
 * Hook for fetching a single agent's activities
 */
export function useAgentActivities(agentName) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentName) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/activities?limit=50`);
        const all = await res.json();
        setActivities(all.filter((a) => a.agent_name === agentName));
      } catch (err) {
        console.error('Failed to fetch agent activities:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [agentName]);

  return { activities, loading };
}
