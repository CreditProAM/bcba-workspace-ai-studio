
import { useState, useEffect, useRef } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutoSave<T>(key: string, data: T, delay: number = 1000) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [error, setError] = useState<Error | null>(null);
  
  // Ref to store the latest data to avoid closure staleness in timeout
  const dataRef = useRef(data);
  const firstRender = useRef(true);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    setStatus('saving');
    
    const handler = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(dataRef.current));
        setStatus('saved');
        setLastSaved(new Date());
        setError(null);
      } catch (err) {
        console.error("Auto-save failed:", err);
        setStatus('error');
        setError(err instanceof Error ? err : new Error('Unknown storage error'));
      }
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [data, key, delay]);

  return { status, lastSaved, error };
}
