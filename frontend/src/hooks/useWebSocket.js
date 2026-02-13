import { useEffect, useRef, useCallback } from 'react';

const listeners = new Set();
let ws = null;
let reconnectTimer = null;

function connect() {
  if (ws && ws.readyState <= 1) return; // CONNECTING or OPEN
  
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${window.location.host}`;
  
  try {
    ws = new WebSocket(url);
    
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        for (const fn of listeners) {
          try { fn(msg.event, msg.data); } catch {}
        }
      } catch {}
    };
    
    ws.onclose = () => {
      ws = null;
      reconnectTimer = setTimeout(connect, 3000);
    };
    
    ws.onerror = () => {
      ws?.close();
    };
  } catch {}
}

export function useWebSocket(callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const stableCallback = useCallback((event, data) => {
    cbRef.current?.(event, data);
  }, []);

  useEffect(() => {
    listeners.add(stableCallback);
    connect();
    
    return () => {
      listeners.delete(stableCallback);
      if (listeners.size === 0 && ws) {
        clearTimeout(reconnectTimer);
        ws.close();
        ws = null;
      }
    };
  }, [stableCallback]);
}
