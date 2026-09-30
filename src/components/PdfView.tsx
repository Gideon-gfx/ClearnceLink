import { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

// Shows a PDF inside the app. The file is downloaded with the login token, then drawn by pdf.js inside a WebView, so
// the reviewer sees the real document instead of a generic icon.
//   mode "thumb": the first page, fitted to its box (for lists)
//   mode "full":  every page, at the given zoom (for the viewer)
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function download(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('The document could not be loaded.');
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('The document could not be read.'));
    reader.readAsDataURL(blob);
  });
}

function pageHtml(base64, mode, zoom) {
  const thumb = mode === 'thumb';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>html,body{margin:0;padding:0;background:${thumb ? '#f3f0fd' : '#3f4a66'};${thumb ? 'overflow:hidden;' : ''}}
#pages{display:flex;flex-direction:column;align-items:${zoom > 1 ? 'flex-start' : 'center'};gap:${thumb ? 0 : 10}px;padding:${thumb ? 0 : 10}px;width:max-content;min-width:100%;box-sizing:border-box}
canvas{background:white;display:block;box-shadow:${thumb ? 'none' : '0 2px 8px rgba(0,0,0,.35)'}}
#msg{color:#fff;font:14px sans-serif;text-align:center;padding:24px}</style></head>
<body><div id="pages"><div id="msg">${thumb ? '' : 'Loading document...'}</div></div>
<script src="${PDFJS}"></script>
<script>
const send = (type, extra) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type }, extra || {})));
(async () => {
  try {
    const lib = window.pdfjsLib;
    const worker = URL.createObjectURL(new Blob(["importScripts('${WORKER}')"], { type: 'text/javascript' }));
    lib.GlobalWorkerOptions.workerSrc = worker;
    const bytes = Uint8Array.from(atob('${base64}'), (c) => c.charCodeAt(0));
    const pdf = await lib.getDocument({ data: bytes }).promise;
    const box = document.getElementById('pages');
    box.innerHTML = '';
    const width = window.innerWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const last = ${thumb ? '1' : 'pdf.numPages'};
    for (let number = 1; number <= last; number++) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const fit = ${thumb ? 'width / base.width' : `((width - 20) * ${zoom}) / base.width`};
      const viewport = page.getViewport({ scale: fit * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      canvas.style.width = (viewport.width / dpr) + 'px'; canvas.style.height = (viewport.height / dpr) + 'px';
      box.appendChild(canvas);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (number === 1) send('ready');
    }
    send('done');
  } catch (error) { send('error', { message: String(error && error.message || error) }); }
})();
</script></body></html>`;
}

export default function PdfView({ url, token, mode = 'full', zoom = 1, style }: { url: string; token: string; mode?: 'thumb' | 'full'; zoom?: number; style?: any }) {
  const [base64, setBase64] = useState<string | null>(null);
  const [failed, setFailed] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    setBase64(null); setFailed(''); setReady(false);
    download(url, token).then((data) => live && setBase64(data)).catch((cause) => live && setFailed(cause.message));
    return () => { live = false; };
  }, [url, token]);
  const html = useMemo(() => (base64 ? pageHtml(base64, mode, zoom) : ''), [base64, mode, zoom]);
  const thumb = mode === 'thumb';

  if (failed) {
    return <View style={[{ alignItems: 'center', justifyContent: 'center', backgroundColor: thumb ? '#f3f0fd' : '#3f4a66', padding: thumb ? 4 : 24 }, style]}><Ionicons name="document-text" size={thumb ? 28 : 56} color={thumb ? '#5A17C9' : 'white'} />{thumb ? null : <Text style={{ color: 'white', marginTop: 10, textAlign: 'center' }}>{failed} Use Download to open it instead.</Text>}</View>;
  }
  return (
    <View style={[{ backgroundColor: thumb ? '#f3f0fd' : '#3f4a66', overflow: 'hidden' }, style]}>
      {base64 ? (
        <WebView
          key={`${mode}-${zoom}`} originWhitelist={['*']} source={{ html, baseUrl: 'https://localhost' }} javaScriptEnabled domStorageEnabled
          scrollEnabled={!thumb} pointerEvents={thumb ? 'none' : 'auto'} bounces={false} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
          style={{ flex: 1, backgroundColor: 'transparent', opacity: thumb && !ready ? 0 : 1 }}
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message.type === 'ready') setReady(true);
              if (message.type === 'error') setFailed(thumb ? 'x' : 'The PDF could not be displayed.');
            } catch { /* ignore */ }
          }}
        />
      ) : null}
      {!ready ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={thumb ? '#5A17C9' : 'white'} /></View> : null}
    </View>
  );
}
