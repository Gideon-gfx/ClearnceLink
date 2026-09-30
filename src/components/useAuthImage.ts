import { useEffect, useState } from 'react';

// Loads an image that needs the login token and returns it as a data URI. Drawing a data URI is more reliable than an
// Image with custom headers, and it tells the caller when the download failed instead of staying blank.
export default function useAuthImage(url: string | null, token: string, version: number | string = 0) {
  const [state, setState] = useState<{ uri: string | null; failed: boolean; loading: boolean }>({ uri: null, failed: false, loading: Boolean(url) });
  useEffect(() => {
    if (!url) { setState({ uri: null, failed: false, loading: false }); return undefined; }
    let live = true;
    setState({ uri: null, failed: false, loading: true });
    (async () => {
      try {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const uri = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(blob);
        });
        if (live) setState({ uri, failed: false, loading: false });
      } catch (error) {
        console.warn('Image could not be loaded:', error instanceof Error ? error.message : error);
        if (live) setState({ uri: null, failed: true, loading: false });
      }
    })();
    return () => { live = false; };
  }, [url, token, version]);
  return state;
}
