import { useState, useEffect, useCallback } from 'react';
import { API_BASE, REFRESH_INTERVAL } from '@/lib/constants';

/**
 * Hook for fetching activities
 */
export function useActivities(limit = 30) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/activities?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch activities');
      const data = await res.json();
      setActivities(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  return { activities, loading, error, refresh: fetchActivities };
}
