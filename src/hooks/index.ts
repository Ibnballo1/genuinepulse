// src/hooks/index.ts
// Reusable custom hooks

import { useState, useEffect, useCallback, useRef } from "react";

// ─── useDebounce ──────────────────────────────────────────────────────────────
// Delays state updates — used for search inputs to avoid excessive API calls

export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─── usePagination ────────────────────────────────────────────────────────────

interface PaginationState {
  page: number;
  limit: number;
}

interface PaginationResult extends PaginationState {
  offset: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

export function usePagination(initialLimit = 20): PaginationResult {
  const [state, setState] = useState<PaginationState>({ page: 1, limit: initialLimit });

  return {
    ...state,
    offset: (state.page - 1) * state.limit,
    setPage: (page: number) => setState((s) => ({ ...s, page: Math.max(1, page) })),
    nextPage: () => setState((s) => ({ ...s, page: s.page + 1 })),
    prevPage: () => setState((s) => ({ ...s, page: Math.max(1, s.page - 1) })),
    reset: () => setState((s) => ({ ...s, page: 1 })),
  };
}

// ─── useLocalStorage ─────────────────────────────────────────────────────────

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const valueToStore = typeof newValue === "function"
        ? (newValue as (prev: T) => T)(value)
        : newValue;
      setValue(valueToStore);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch {}
      }
    },
    [key, value]
  );

  return [value, setStoredValue] as const;
}

// ─── useAsyncAction ───────────────────────────────────────────────────────────
// Wraps an async function with loading/error state

export function useAsyncAction<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: TArgs): Promise<TReturn | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(...args);
        return result;
      } catch (e: any) {
        setError(e?.message ?? "An unexpected error occurred");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fn]
  );

  return { execute, loading, error, clearError: () => setError(null) };
}

// ─── useInterval ──────────────────────────────────────────────────────────────

export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ─── useIsFirstRender ─────────────────────────────────────────────────────────

export function useIsFirstRender() {
  const isFirst = useRef(true);
  useEffect(() => { isFirst.current = false; }, []);
  return isFirst.current;
}
