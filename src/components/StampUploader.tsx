import { useLanguage } from '../i18n/LanguageContext';
import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { apiBaseUrl } from '../api';
import ErrorBanner from './ErrorBanner';
import useAuthImage from './useAuthImage';
import { pickStampImage } from './pickStampImage';
import StampPlacement, { placementLabel } from './StampPlacement';

const MAX_BYTES = 1.5 * 1024 * 1024;

async function toBase64(uri: string) {
  const blob = await (await fetch(uri)).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(blob);
  });
}

// Upload / preview / remove a digital stamp or signature. `basePath` is '/api/staff' or '/api/institution'.
export default function StampUploader({ basePath, token, title = 'Digital stamp / signature', description }) {
  const { t } = useLanguage();
  const [stamp, setStamp] = useState(undefined); // undefined = loading, null = none
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [positioning, setPositioning] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };
  const image = useAuthImage(stamp ? `${apiBaseUrl}${basePath}/stamp/image` : null, token, version);

  useEffect(() => {
    let live = true;
    fetch(`${apiBaseUrl}${basePath}/stamp`, { headers })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || t("Could not load your stamp.")); return body; })
      .then((body) => live && setStamp(body.stamp))
      .catch((cause) => { if (live) { setStamp(null); setError(t(cause.message)); } });
    return () => { live = false; };
  }, [basePath, token]);

  const upload = async () => {
    setError('');
    try {
      const picked = await pickStampImage();
      if (!picked) return;
      setBusy(true);
      const response = await fetch(`${apiBaseUrl}${basePath}/stamp`, {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: picked.name, mimeType: picked.mimeType, base64: picked.base64 }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t("Could not upload the stamp."));
      setStamp(body.stamp);
      setVersion((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not upload the stamp.")); }
    finally { setBusy(false); }
  };

  const savePlacement = async (placement) => {
    const response = await fetch(`${apiBaseUrl}${basePath}/stamp/placement`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(placement) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || t("Could not save the position."));
    setStamp(body.stamp);
  };

  const remove = async () => {
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}${basePath}/stamp`, { method: 'DELETE', headers });
      if (!response.ok) throw new Error((await response.json()).error || t("Could not remove the stamp."));
      setStamp(null);
    } catch (cause) { setError(t(cause.message)); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#e6e3f7', padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Ionicons name="ribbon-outline" size={20} color="#5a17c9" style={{ marginRight: 8 }} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#171548' }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 12, lineHeight: 18, color: '#6e6b91', marginBottom: 12 }}>
        {description || t("Upload your stamp or signature (any picture works) and choose where it goes on the page. It is added to every document you clear, in a stamped PDF copy.")}
      </Text>
      <View style={{ height: 120, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#cfc6f2', backgroundColor: '#faf8ff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        {stamp === undefined ? <ActivityIndicator color="#5a17c9" /> : stamp ? (
          image.uri ? <Image source={{ uri: image.uri }} resizeMode="contain" style={{ width: '80%', height: '85%' }} /> : image.failed ? <Text style={{ fontSize: 12, color: '#dc2626', textAlign: 'center', paddingHorizontal: 12 }}>{t("Your stamp is saved, but the picture could not be loaded. Pull down to retry or replace it.")}</Text> : <ActivityIndicator color="#5a17c9" />
        ) : (
          <>
            <Ionicons name="image-outline" size={30} color="#b9a4f2" />
            <Text style={{ marginTop: 4, fontSize: 12, color: '#8f8bab' }}>{t("No stamp uploaded yet")}</Text>
          </>
        )}
      </View>
      {stamp ? <Pressable accessibilityRole="button" onPress={() => setPositioning(true)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#d6ccf3', backgroundColor: '#faf8ff' }}><Ionicons name="move-outline" size={20} color="#5a17c9" style={{ marginRight: 10 }} /><View style={{ flex: 1 }}><Text style={{ fontSize: 12, color: '#6e6b91' }}>{t("Position on the page")}</Text><Text style={{ fontSize: 14, fontWeight: '700', color: '#171548' }}>{placementLabel(stamp.placement)}</Text></View><Text style={{ fontSize: 13, fontWeight: '700', color: '#5a17c9' }}>{t("Change")}</Text></Pressable> : null}
      <ErrorBanner message={error} style={{ marginBottom: 10 }} />
      <StampPlacement visible={positioning} imageUri={image.uri} value={stamp?.placement} onClose={() => setPositioning(false)} onSave={savePlacement} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={busy ? undefined : upload} style={{ flex: 1, height: 46, borderRadius: 12, backgroundColor: '#5a17c9', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: busy ? 0.7 : 1 }}>
          <Ionicons name="cloud-upload-outline" size={18} color="white" style={{ marginRight: 6 }} />
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>{busy ? t("Please wait...") : stamp ? t("Replace stamp") : t("Upload stamp")}</Text>
        </Pressable>
        {stamp ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Remove stamp" onPress={busy ? undefined : remove} style={{ width: 46, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trash-outline" size={19} color="#dc2626" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
