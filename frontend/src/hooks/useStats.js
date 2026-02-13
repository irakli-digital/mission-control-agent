import { useState, useEffect, useCallback } from 'react';
import { REFRESH_INTERVAL } from '@/lib/constants';
import { apiGet } from '@/lib/fetch';

export function useStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiGet('/api/stats');
      setStats(data);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
}

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/projects').then(setProjects).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return { projects, loading };
}

export function useTags() {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet('/api/tags').then(setTags).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return { tags, loading };
}
