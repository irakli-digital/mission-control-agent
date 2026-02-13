import { useState, useCallback } from 'react';
import { API_BASE } from '@/lib/constants';

function getAuthHeader() {
  const creds = localStorage.getItem('mc_credentials');
  if (!creds) return {};
  return { Authorization: `Basic ${btoa(creds)}` };
}

export function setCredentials(user, pass) {
  localStorage.setItem('mc_credentials', `${user}:${pass}`);
}

export function clearCredentials() {
  localStorage.removeItem('mc_credentials');
}

export function hasCredentials() {
  return !!localStorage.getItem('mc_credentials');
}

/**
 * Base API hook with loading and error states
 */
export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJSON = useCallback(async (path, options = {}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          ...getAuthHeader(),
          ...(options.headers || {}),
        },
      });
      if (res.status === 401) {
        clearCredentials();
        window.dispatchEvent(new Event('mc:auth-required'));
        throw new Error('Authentication required');
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await res.json();
      }
      return await res.text();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const postJSON = useCallback(async (path, body) => {
    return fetchJSON(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, [fetchJSON]);

  const patchJSON = useCallback(async (path, body) => {
    return fetchJSON(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, [fetchJSON]);

  const deleteJSON = useCallback(async (path) => {
    return fetchJSON(path, { method: 'DELETE' });
  }, [fetchJSON]);

  const putJSON = useCallback(async (path, body) => {
    return fetchJSON(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, [fetchJSON]);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, fetchJSON, postJSON, patchJSON, deleteJSON, putJSON, clearError };
}

/**
 * Utility functions for formatting
 */
export function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function formatTime(mins) {
  if (!mins) return '0m';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatTokens(tokens) {
  if (!tokens) return '0';
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens;
}
