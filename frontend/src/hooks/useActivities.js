import { useState, useEffect, useCallback } from 'react';
import { REFRESH_INTERVAL } from '@/lib/constants';
import { apiGet } from '@/lib/fetch';

export function useActivities(limit = 30) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await apiGet(`/api/activities?limit=${limit}`);
      setActivities(data);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  return { activities, loading, error, refresh: fetchActivities };
}
