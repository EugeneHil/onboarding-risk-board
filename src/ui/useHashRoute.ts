import { useCallback, useEffect, useState } from 'react';

export type Route = { name: 'board' } | { name: 'employee'; id: string };

export function parseHash(hash: string): Route {
  const match = /^#\/employee\/(.+)$/.exec(hash);
  if (match) {
    try {
      return { name: 'employee', id: decodeURIComponent(match[1] as string) };
    } catch {
      return { name: 'employee', id: match[1] as string };
    }
  }
  return { name: 'board' };
}

export function useHashRoute(): { route: Route; navigate: (hash: string) => void } {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    onChange();
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  return { route, navigate };
}
