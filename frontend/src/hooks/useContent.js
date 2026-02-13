import { useState, useEffect, useCallback } from 'react';
import { REFRESH_INTERVAL } from '@/lib/constants';
import { apiGet, apiPost, apiPatch, apiFetch } from '@/lib/fetch';

export function useContent({ filterPlatform = '', filterStatus = '' } = {}) {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchContent = useCallback(async () => {
    try {
      let url = '/api/content?';
      if (filterPlatform) url += `platform=${encodeURIComponent(filterPlatform)}&`;
      if (filterStatus) url += `status=${encodeURIComponent(filterStatus)}&`;
      const data = await apiGet(url);
      setContent(data);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [filterPlatform, filterStatus]);

  useEffect(() => {
    fetchContent();
    const interval = setInterval(fetchContent, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchContent]);

  const moveContent = useCallback(async (contentId, status) => {
    await apiPost(`/api/content/${contentId}/move`, { status });
    await fetchContent();
  }, [fetchContent]);

  const createContent = useCallback(async (data) => {
    const newContent = await apiPost('/api/content', data);
    await fetchContent();
    return newContent;
  }, [fetchContent]);

  const updateContent = useCallback(async (contentId, updates) => {
    await apiPatch(`/api/content/${contentId}`, updates);
    await fetchContent();
  }, [fetchContent]);

  const deleteContent = useCallback(async (contentId) => {
    await apiFetch(`/api/content/${contentId}`, { method: 'DELETE' });
    await fetchContent();
  }, [fetchContent]);

  return { content, loading, error, refresh: fetchContent, moveContent, createContent, updateContent, deleteContent };
}

export function useContentItem(contentId) {
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchItem = useCallback(async () => {
    if (!contentId) { setItem(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiGet(`/api/content/${contentId}`);
      setItem(data);
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [contentId]);

  useEffect(() => { fetchItem(); }, [fetchItem]);
  return { item, loading, error, refresh: fetchItem };
}

export function useContentStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try { setStats(await apiGet('/api/content/stats')); }
      catch {} finally { setLoading(false); }
    };
    fetch();
    const interval = setInterval(fetch, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return { stats, loading };
}
