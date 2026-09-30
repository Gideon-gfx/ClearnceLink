import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { readFileAsBase64 } from '../components/readFile';
import { Alert, Pressable, Text, View } from 'react-native';
import { C, Card, Heading, Input, Message, Secondary } from './ui';

const formatSize = (bytes) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

async function pickFile(types) {
  const result = await DocumentPicker.getDocumentAsync({ type: types || '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 5 * 1024 * 1024) throw new Error('Choose a file under 5MB.');
  const base64 = await readFileAsBase64(asset.uri);
  return { name: asset.name, mimeType: asset.mimeType || 'application/octet-stream', base64 };
}

// Completion actions for one student: their ID card (digital delivery) and any other official documents.
export default function StudentCompletion({ api, id, item, onChanged }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (task, message) => {
    setError(''); setNotice(''); setBusy(true);
    try { const result = await task(); if (result?.item) onChanged(result.item); if (message) setNotice(message); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const uploadIdCard = () => run(async () => {
    const file = await pickFile(['image/png', 'image/jpeg', 'application/pdf']);
    return file ? api.request(`/students/${id}/idcard`, file, 'PUT') : null;
  }, 'ID card uploaded. The student has been notified.');
  const removeIdCard = () => Alert.alert('Remove ID card?', 'The student will no longer see it.', [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => run(() => api.request(`/students/${id}/idcard`, {}, 'DELETE'), 'ID card removed.') }]);
  const uploadDocument = () => {
    if (!title.trim()) { setError('Give the document a title first.'); return; }
    return run(async () => {
      const file = await pickFile(null);
      if (!file) return null;
      const result = await api.request(`/students/${id}/documents`, { ...file, title: title.trim() }, 'POST');
      setTitle('');
      return result;
    }, 'Document uploaded. The student has been notified.');
  };
  const removeDocument = (document) => Alert.alert('Remove document?', document.title, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => run(() => api.request(`/students/${id}/documents/${document.id}`, {}, 'DELETE'), 'Document removed.') }]);

  return (
    <>
      <Heading>Completion Actions</Heading>
      <Message text={error} error /><Message text={notice} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="card-outline" size={22} color={C.purple} style={{ marginRight: 11 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.ink, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Student ID card</Text>
            <Text numberOfLines={1} style={{ marginTop: 2, color: C.muted, fontSize: 11 }}>{item.idCard ? `${item.idCard.name} · ${formatSize(item.idCard.size)}` : 'Not uploaded yet'}</Text>
          </View>
          {item.idCard ? <Pressable accessibilityLabel="Remove ID card" onPress={removeIdCard} style={{ padding: 6 }}><Ionicons name="trash-outline" size={19} color={C.red} /></Pressable> : null}
        </View>
        <View style={{ marginTop: 11 }}><Secondary title={item.idCard ? 'Replace ID Card' : 'Upload ID Card'} icon="cloud-upload-outline" onPress={busy ? undefined : uploadIdCard} /></View>
        <Text style={{ marginTop: 8, color: C.muted, fontSize: 10.5 }}>PNG, JPG or PDF, up to 5MB. Shown to the student when your completion action includes a digital ID card.</Text>
      </Card>
      <Card>
        <Text style={{ color: C.ink, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 10 }}>Other official documents</Text>
        {(item.officialDocuments || []).map((document) => (
          <View key={document.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: C.line }}>
            <Ionicons name="document-text-outline" size={19} color={C.purple} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{document.title}</Text>
              <Text numberOfLines={1} style={{ marginTop: 1, color: C.muted, fontSize: 10.5 }}>{document.name} · {formatSize(document.size)}</Text>
            </View>
            <Pressable accessibilityLabel={`Remove ${document.title}`} onPress={() => removeDocument(document)} style={{ padding: 6 }}><Ionicons name="trash-outline" size={18} color={C.red} /></Pressable>
          </View>
        ))}
        {(item.officialDocuments || []).length === 0 ? <Text style={{ color: C.muted, fontSize: 11, marginBottom: 10 }}>No documents uploaded yet.</Text> : null}
        <View style={{ marginTop: 10 }}>
          <Input label="Document title" value={title} onChangeText={setTitle} placeholder="e.g. Admission Confirmation Letter" />
          <Secondary title="Choose File & Upload" icon="cloud-upload-outline" onPress={busy ? undefined : uploadDocument} />
        </View>
      </Card>
    </>
  );
}
