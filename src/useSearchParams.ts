import { useState, useEffect, useCallback } from 'react';

export function useSearchParams() {
  const [searchParams, setSearchParamsState] = useState(() => 
    new URLSearchParams(window.location.search)
  );

  const setSearchParams = useCallback((params: Record<string, string>) => {
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    window.history.replaceState({}, '', url.toString());
    setSearchParamsState(new URLSearchParams(url.search));
  }, []);

  const removeSearchParam = useCallback((paramName: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(paramName);
    window.history.replaceState({}, '', url.toString());
    setSearchParamsState(new URLSearchParams(url.search));
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setSearchParamsState(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return [searchParams, setSearchParams, removeSearchParam] as const;
}