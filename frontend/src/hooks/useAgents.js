import { useState, useEffect, useCallback } from 'react';
import { REFRESH_INTERVAL } from '@/lib/constants';
import { apiGet } from '@/lib/fetch';

export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await apiGet('/api/agents');
      setAgents(data);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  return { agents, loading, error, refresh: fetchAgents };
}

export function useAgentTasks(agentName) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentName) { setTasks([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      try {
        const data = await apiGet(`/api/tasks?agent=${encodeURIComponent(agentName)}&archived=false`);
        setTasks(data);
      } catch (err) { console.error('Failed to fetch agent tasks:', err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [agentName]);

  return { tasks, loading };
}

export function useAgentActivities(agentName) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!agentName) { setActivities([]); setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      try {
        const all = await apiGet('/api/activities?limit=50');
        setActivities(all.filter((a) => a.agent_name === agentName));
      } catch (err) { console.error('Failed to fetch agent activities:', err); }
      finally { setLoading(false); }
    };
    fetch();
  }, [agentName]);

  return { activities, loading };
}
