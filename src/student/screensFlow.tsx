import { useEffect, useRef, useState } from 'react';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'qrcode';
import QRCodeSvg from 'react-native-qrcode-svg';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { apiBaseUrl, apiRequest } from '../api';
import { downloadAndShare, printFile, stampedName } from '../components/downloadFile';
import FolderExport from './FolderExport';
import PdfView from '../components/PdfView';
import { Card, ErrorText, INK, InstitutionMark, LINE, MUTED, PURPLE, ClearanceChain, ScreenHeader, SolidButton, StatusBadge, fileSource, formatDate, formatSize, shortName, useBusy } from './ui';

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];

export function useClearance(app, id) {
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    let live = true;
    apiRequest(`/api/student/clearances/${id}`, undefined, app.token)
      .then((data) => live && setState({ data, error: '' }))
      .catch((cause) => live && setState({ data: null, error: cause.message }));
    return () => { live = false; };
  }, [id, app.version]);
  return state;
}

function Loading({ error, onBack, title }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title={title} onBack={onBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {error ? <View style={{ width: '100%' }}><ErrorBanner message={error} /></View> : <ActivityIndicator color={PURPLE} />}
      </View>
    </View>
  );
}

function findRequirement(clearance, requirementId) {
  for (const stage of clearance.stages) {
    const requirement = stage.requirements.find((item) => item.id === requirementId);
    if (requirement) return { stage, requirement };
  }
  return {};
}

async function toBase64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(blob);
  });
}
async function fetchDataUrl(fileId, token) {
  const blob = await (await fetch(`${apiBaseUrl}/api/files/${fileId}`, { headers: { Authorization: `Bearer ${token}` } })).blob();
  return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result)); reader.readAsDataURL(blob); });
}
async function shareHtml(html) {
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
function qrSvg(text) {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'M' }).modules;
  let path = '';
  for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) if (data[row * size + col]) path += `M${col} ${row}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="110" height="110"><path d="${path}" fill="#171548"/></svg>`;
}

// ---------- Upload overlay: slides up from the bottom of the clearance screen ----------
function UploadSheet({ requirement, clearance, app, onClose }) {
  const [picked, setPicked] = useState(null);
  const { busy, error, setError, run } = useBusy();
  const last = useRef(null);
  if (requirement) last.current = requirement;
  const req = requirement || last.current;
  useEffect(() => { setPicked(null); setError(''); }, [requirement?.id]);
  if (!req) return null;
  const acceptsPdf = /PDF/i.test(req.hint || '');

  const accept = (file) => {
    const mime = file.mimeType || (/\.png$/i.test(file.name) ? 'image/png' : /\.pdf$/i.test(file.name) ? 'application/pdf' : 'image/jpeg');
    if (!ALLOWED.includes(mime)) { setError('Only PDF, JPG and PNG files are supported.'); return; }
    if (file.size && file.size > req.maxMb * 1024 * 1024) { setError(`File is larger than ${req.maxMb}MB.`); return; }
    setError('');
    setPicked({ uri: file.uri, name: file.name, size: file.size, mimeType: mime });
  };
  const choosePdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!result.canceled) accept({ uri: result.assets[0].uri, name: result.assets[0].name, size: result.assets[0].size, mimeType: result.assets[0].mimeType });
  };
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) { const a = result.assets[0]; accept({ uri: a.uri, name: a.fileName || `photo.${a.mimeType === 'image/png' ? 'png' : 'jpg'}`, size: a.fileSize, mimeType: a.mimeType }); }
  };
  const submit = () => run(async () => {
    const dataBase64 = await toBase64(picked.uri);
    await apiRequest('/api/student/submissions', { clearanceId: clearance.id, requirementId: req.id, fileName: picked.name, mimeType: picked.mimeType, dataBase64 }, app.token);
    app.bump();
    onClose();
  });
  const isImage = picked?.mimeType?.startsWith('image/');
  const close = () => { if (!busy) onClose(); };
  return (
    <Modal transparent visible={Boolean(requirement)} animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(23,19,43,0.5)' }} />
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 26, maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#D6D3DF', marginBottom: 14 }} />
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 21, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK, marginBottom: 12 }}>Upload Document</Text>
            <Card style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#f0edff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="document-text-outline" size={22} color={PURPLE} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontFamily: 'Inter_700Bold', fontWeight: '700', color: INK }}>{req.name}</Text>
                <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{req.hint}</Text>
              </View>
            </Card>
            {picked ? (
              <View style={{ marginBottom: 14 }}>
                {isImage ? <Image source={{ uri: picked.uri }} resizeMode="cover" style={{ width: '100%', height: 220, borderRadius: 16, backgroundColor: '#f3f0fd' }} /> : (
                  <Card style={{ alignItems: 'center', paddingVertical: 24 }}><Ionicons name="document" size={44} color={PURPLE} /></Card>
                )}
                <Text numberOfLines={1} style={{ marginTop: 10, fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: INK }}>{picked.name}</Text>
                <Text style={{ fontSize: 13, color: MUTED }}>{{ 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG' }[picked.mimeType]}{picked.size ? ` • ${formatSize(picked.size)}` : ''}</Text>
              </View>
            ) : null}
            <View style={{ gap: 10 }}>
              {acceptsPdf ? <SolidButton variant="outline" icon="document-text-outline" title={picked ? 'Change PDF' : 'Choose PDF'} onPress={choosePdf} /> : null}
              <SolidButton variant="outline" icon="image-outline" title={picked ? 'Change Photo' : 'Choose Photo'} onPress={choosePhoto} />
              <ErrorText>{error}</ErrorText>
              <SolidButton title={picked ? 'Upload Document' : 'Select a file to continue'} disabled={!picked} busy={busy} onPress={submit} />
              <Text style={{ textAlign: 'center', fontSize: 13, color: MUTED }}>Accepted: PDF, JPG, PNG · Max {req.maxMb}MB. The file is sent to your reviewer.</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ---------- Clearance detail (stage stepper + required documents) ----------
export function ClearanceDetailScreen({ app, params }) {
  const { data, error } = useClearance(app, params.id);
  const [selected, setSelected] = useState(null);
  const [uploadFor, setUploadFor] = useState(null);
  if (!data) return <Loading title="Clearance" error={error} onBack={app.back} />;
  const clearance = data.clearance;
  const stage = clearance.stages.find((item) => item.id === selected) || clearance.stages.find((item) => item.status !== 'cleared') || clearance.stages[0];
  const uploads = stage.requirements.filter((item) => item.kind === 'upload');
  const rejected = uploads.find((item) => item.status === 'action_required');
  const fresh = uploads.find((item) => item.status === 'not_started');
  const nextStage = clearance.stages[clearance.stages.indexOf(stage) + 1];
  // A document still to upload opens the upload overlay; anything else opens its own screen.
  const openDoc = (requirement) => (requirement.kind === 'upload' && requirement.status === 'not_started' ? setUploadFor(requirement) : app.openRequirement(clearance, requirement));
  let cta = { title: 'Submitted for Review', disabled: true };
  if (rejected) cta = { title: 'Fix Rejected Document', onPress: () => app.openRequirement(clearance, rejected) };
  else if (fresh) cta = { title: 'Upload Next Document', onPress: () => setUploadFor(fresh) };
  else if (stage.status === 'cleared' && nextStage) cta = { title: `Continue to ${nextStage.name}`, onPress: () => setSelected(nextStage.id) };
  else if (stage.status === 'cleared') cta = { title: 'Stage Cleared', disabled: true };
  else if (stage.requirements.some((item) => item.kind === 'ground')) cta = { title: 'Awaiting Clearance Officer', disabled: true };
  else if (uploads.length === 0) cta = { title: 'Awaiting Institution Verification', disabled: true };
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title={clearance.name} onBack={app.back} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 16 }}>
        {clearance.status === 'completed' ? (
          <Card onPress={() => app.replace('completed', { id: clearance.id })} style={{ marginBottom: 14, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={24} color="#16a34a" />
            <Text style={{ flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '700', color: '#15803d' }}>Clearance completed — view completion actions</Text>
            <Ionicons name="chevron-forward" size={18} color="#15803d" />
          </Card>
        ) : null}
        {app.overview.clearances.length > 1 ? (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ fontSize: 14, color: MUTED, marginBottom: 8 }}>Your clearance path</Text>
            <ClearanceChain clearances={app.overview.clearances} currentId={clearance.id} onPress={(item) => (item.id === clearance.id ? undefined : app.replace(item.status === 'completed' ? 'completed' : 'clearance', { id: item.id }))} />
          </View>
        ) : null}
        {clearance.stages.length > 1 ? (
          <View style={{ flexDirection: 'row', marginBottom: 20 }}>
            {clearance.stages.map((item, index) => {
              const on = item.id === stage.id;
              const done = item.status === 'cleared';
              const color = done ? '#16a34a' : item.status === 'action_required' ? '#dc2626' : on ? PURPLE : '#d9d3f0';
              return (
                <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}, step ${index + 1}`} onPress={() => setSelected(item.id)} style={{ flex: 1, alignItems: 'center' }}>
                  {index < clearance.stages.length - 1 ? <View style={{ position: 'absolute', top: 16, left: '50%', right: '-50%', height: 4, borderRadius: 2, backgroundColor: done ? '#16a34a' : '#E3DDF5' }} /> : null}
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 4 : 0, borderColor: '#ddd2fb' }}>
                    {done ? <Ionicons name="checkmark" size={20} color="white" /> : <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700' }}>{item.status === 'action_required' ? '!' : index + 1}</Text>}
                  </View>
                  <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 12, color: on ? INK : MUTED, fontFamily: on ? 'Inter_700Bold' : 'Inter_500Medium', fontWeight: on ? '700' : '500' }}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Card style={{ marginBottom: 16, backgroundColor: '#faf8ff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: INK }}>{stage.name} Clearance</Text>
            <StatusBadge status={stage.status} />
          </View>
          <Text style={{ fontSize: 15, color: MUTED, marginTop: 6 }}>{uploads.length ? 'Complete all required documents and submit for review.' : 'This step is verified by the institution from its own records.'}</Text>
        </Card>
        <Text style={{ fontSize: 17, fontWeight: '700', color: INK, marginBottom: 10 }}>Required Documents</Text>
        {stage.requirements.map((requirement) => {
          const s = requirement.status;
          const icon = s === 'cleared' ? ['checkmark-circle', '#16a34a'] : s === 'action_required' ? ['alert-circle', '#dc2626'] : s === 'pending' || s === 'resubmitted' ? ['time', '#d97706'] : requirement.kind === 'upload' ? ['cloud-upload-outline', PURPLE] : ['hourglass-outline', '#8b87a6'];
          return (
            <Card key={requirement.id} onPress={() => openDoc(requirement)} style={{ marginBottom: 10, flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#f0edff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="document-text-outline" size={18} color={PURPLE} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>{requirement.name}</Text>
                <Text style={{ fontSize: 13, color: s === 'action_required' ? '#dc2626' : MUTED, marginTop: 2 }}>{s === 'not_started' ? requirement.hint : s === 'action_required' ? 'Rejected — tap to re-upload' : s === 'cleared' ? 'Cleared' : 'Pending review'}</Text>
              </View>
              <Ionicons name={icon[0]} size={24} color={icon[1]} />
            </Card>
          );
        })}
      </ScrollView>
      <View style={{ padding: 18, paddingTop: 6 }}><SolidButton title={cta.title} onPress={cta.onPress} disabled={cta.disabled} /></View>
      <UploadSheet requirement={uploadFor} clearance={clearance} app={app} onClose={() => setUploadFor(null)} />
    </View>
  );
}

// ---------- Upload / view a requirement ----------
export function RequirementScreen({ app, params }) {
  const { data, error } = useClearance(app, params.clearanceId);
  const [picked, setPicked] = useState(null);
  const { busy, error: uploadError, setError, run } = useBusy();
  const pickRef = useRef(null);
  const started = useRef(false);
  // Arriving from a not-yet-uploaded document opens the file picker once the screen is ready.
  useEffect(() => {
    if (!params.autoPick || !data || started.current) return undefined;
    started.current = true;
    const timer = setTimeout(() => pickRef.current?.(), 300);
    return () => clearTimeout(timer);
  }, [data]);
  if (!data) return <Loading title="Upload Document" error={error} onBack={app.back} />;
  const clearance = data.clearance;
  const { requirement } = findRequirement(clearance, params.requirementId);
  if (!requirement) return <Loading title="Upload Document" error="Requirement not found." onBack={app.back} />;
  const submission = requirement.submission;
  const canUpload = requirement.kind === 'upload' && (requirement.status === 'not_started' || requirement.status === 'action_required');

  const accept = (file) => {
    const mime = file.mimeType || (/\.png$/i.test(file.name) ? 'image/png' : /\.pdf$/i.test(file.name) ? 'application/pdf' : 'image/jpeg');
    if (!ALLOWED.includes(mime)) { setError('Only PDF, JPG and PNG files are supported.'); return; }
    if (file.size && file.size > requirement.maxMb * 1024 * 1024) { setError(`File is larger than ${requirement.maxMb}MB.`); return; }
    setError('');
    setPicked({ uri: file.uri, name: file.name, size: file.size, mimeType: mime });
  };
  const chooseFile = async () => {
    // PDFs only here: phones list photos first when images are allowed, which hides the PDFs. Photos have their own button.
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!result.canceled) accept({ uri: result.assets[0].uri, name: result.assets[0].name, size: result.assets[0].size, mimeType: result.assets[0].mimeType });
  };
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) { const a = result.assets[0]; accept({ uri: a.uri, name: a.fileName || `photo.${a.mimeType === 'image/png' ? 'png' : 'jpg'}`, size: a.fileSize, mimeType: a.mimeType }); }
  };
  const acceptsPdf = /PDF/i.test(requirement.hint || '');
  pickRef.current = acceptsPdf ? chooseFile : choosePhoto;
  const submit = () => run(async () => {
    const dataBase64 = await toBase64(picked.uri);
    await apiRequest('/api/student/submissions', { clearanceId: clearance.id, requirementId: requirement.id, fileName: picked.name, mimeType: picked.mimeType, dataBase64 }, app.token);
    app.bump();
    app.back();
  });

  const preview = picked || (submission?.fileId ? { name: submission.fileName, size: submission.size, mimeType: submission.mimeType, remote: true } : null);
  const isImage = preview?.mimeType?.startsWith('image/');
  const source = picked ? { uri: picked.uri } : submission?.fileId ? fileSource(submission.fileId, app.token) : null;
  const showStamped = requirement.status === 'cleared' && Boolean(submission?.stampedFileId) && !picked;
  const pending = requirement.status === 'pending' || requirement.status === 'resubmitted' || ((requirement.kind === 'institution' || requirement.kind === 'ground') && requirement.status !== 'cleared');
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Upload Document" onBack={app.back} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#f0edff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name="document-text-outline" size={18} color={PURPLE} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>{requirement.name}</Text>
            <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{requirement.hint}</Text>
          </View>
          {!canUpload ? <StatusBadge status={requirement.status} /> : null}
        </Card>

        {preview ? (
          <View style={{ marginBottom: 14 }}>
            {showStamped ? (
              <View>
                <PdfView mode="full" url={`${apiBaseUrl}/api/files/${submission.stampedFileId}`} token={app.token} style={{ height: 430, borderRadius: 16 }} />
                <View style={{ position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Ionicons name="ribbon" size={14} color="#15803d" style={{ marginRight: 4 }} /><Text style={{ fontSize: 13, fontWeight: '700', color: '#15803d' }}>Stamped copy</Text>
                </View>
              </View>
            ) : isImage && source ? (
              <View>
                <Image source={source} resizeMode="cover" style={{ width: '100%', height: 300, borderRadius: 16, backgroundColor: '#f3f0fd' }} />
                {picked ? <Pressable accessibilityRole="button" accessibilityLabel="Remove file" onPress={() => setPicked(null)} style={{ position: 'absolute', right: 10, top: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash-outline" size={18} color="#dc2626" /></Pressable> : null}
              </View>
            ) : (
              <View>
                <PdfView mode="full" url={picked ? picked.uri : `${apiBaseUrl}/api/files/${submission?.fileId}`} token={app.token} style={{ height: 380, borderRadius: 16 }} />
                {picked ? <Pressable accessibilityRole="button" accessibilityLabel="Remove file" onPress={() => setPicked(null)} style={{ position: 'absolute', right: 10, top: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash-outline" size={18} color="#dc2626" /></Pressable> : null}
              </View>
            )}
            <View style={{ marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: MUTED }}>File Name</Text><Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: INK }}>{preview.name}</Text></View>
              <View style={{ width: 60 }}><Text style={{ fontSize: 13, color: MUTED }}>File Type</Text><Text style={{ fontSize: 15, fontWeight: '600', color: INK }}>{{ 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG' }[preview.mimeType]}</Text></View>
              <View style={{ width: 64 }}><Text style={{ fontSize: 13, color: MUTED }}>File Size</Text><Text style={{ fontSize: 15, fontWeight: '600', color: INK }}>{preview.size ? formatSize(preview.size) : '—'}</Text></View>
            </View>
          </View>
        ) : null}

        {canUpload ? (
          <View style={{ gap: 10 }}>
            {acceptsPdf ? (
              <Pressable accessibilityRole="button" onPress={chooseFile} style={{ height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#d6ccf3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="document-text-outline" size={18} color={PURPLE} /><Text style={{ fontSize: 17, fontWeight: '700', color: PURPLE }}>{picked ? 'Change PDF' : 'Choose PDF'}</Text>
            </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={choosePhoto} style={{ height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#d6ccf3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="image-outline" size={18} color={PURPLE} /><Text style={{ fontSize: 17, fontWeight: '700', color: PURPLE }}>{picked ? 'Change Photo' : 'Choose Photo'}</Text>
            </Pressable>
            <ErrorText>{uploadError}</ErrorText>
            <SolidButton title={picked ? 'Upload Document' : 'Select a file to continue'} disabled={!picked} busy={busy} onPress={submit} />
            <Text style={{ textAlign: 'center', fontSize: 14, color: MUTED }}>Accepted: PDF, JPG, PNG · Max {requirement.maxMb}MB. The file is sent to your reviewer.</Text>
          </View>
        ) : (
          <View>
            {pending ? (
              <Card style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="time" size={22} color="#d97706" />
                <Text style={{ flex: 1, marginLeft: 10, fontSize: 15, color: '#92400e' }}>{requirement.kind === 'ground' ? 'Your clearance officer will clear this in person.' : requirement.kind === 'institution' ? 'The institution will verify this from its own records.' : `${requirement.status === 'resubmitted' ? 'Re-submitted' : 'Submitted'} ${formatDate(submission?.submittedAt)} — pending review.`}</Text>
              </Card>
            ) : null}
            {requirement.status === 'cleared' && submission?.fileId ? <View style={{ marginTop: 6 }}><ClearedActions sub={submission} token={app.token} /></View> : null}
            <ErrorText>{uploadError}</ErrorText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ---------- Rejected ----------
export function RejectedScreen({ app, params }) {
  const { data, error } = useClearance(app, params.clearanceId);
  if (!data) return <Loading title="Document Rejected" error={error} onBack={app.back} />;
  const clearance = data.clearance;
  const { requirement } = findRequirement(clearance, params.requirementId);
  const sub = requirement.submission;
  const earlier = (requirement.history || []).slice(1);
  return (
    <View style={{ flex: 1, backgroundColor: '#fff5f5' }}>
      <ScreenHeader title="Document Rejected" onBack={app.back} tint="#fff5f5" />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 20 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: '#fecaca', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="alert" size={32} color="white" /></View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: INK, textAlign: 'center', marginTop: 14 }}>Your {requirement.name} was rejected</Text>
          <View style={{ marginTop: 8 }}><StatusBadge status="action_required" label="REJECTED · ACTION REQUIRED" /></View>
        </View>
        <Card style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK }}>Reason</Text>
          <Text style={{ fontSize: 15, color: MUTED, marginTop: 4 }}>{sub?.reason || 'Document rejected.'}</Text>
        </Card>
        {sub?.message ? (
          <Card style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: INK }}>Officer’s Message</Text>
            <Text style={{ fontSize: 15, color: MUTED, marginTop: 4, lineHeight: 18 }}>{sub.message}</Text>
          </Card>
        ) : null}
        <Text style={{ fontSize: 14, color: MUTED, marginBottom: 20 }}>{sub?.reviewer ? `${sub.reviewer} · ` : ''}{formatDate(sub?.reviewedAt)}</Text>
        {earlier.length ? <Text style={{ fontSize: 14, color: MUTED, marginBottom: 20 }}>{earlier.length} earlier submission{earlier.length > 1 ? 's' : ''} kept in your history.</Text> : null}
        <SolidButton title="Re-upload Document" onPress={() => app.replace('requirement', { clearanceId: clearance.id, requirementId: requirement.id })} />
      </ScrollView>
    </View>
  );
}

// ---------- Cleared ----------
// The stamped PDF copy of a cleared document: download it, or print it.
function StampedActions({ sub, token }) {
  const { busy, error, run } = useBusy();
  const url = `${apiBaseUrl}/api/files/${sub.stampedFileId}`;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 8, textAlign: 'center' }}>Your document now carries the official stamp.</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><SolidButton icon="download-outline" title="Download" busy={busy} onPress={() => run(() => downloadAndShare(url, stampedName(sub.fileName), token, 'application/pdf'))} /></View>
        <View style={{ flex: 1 }}><SolidButton variant="outline" icon="print-outline" title="Print" busy={busy} onPress={() => run(() => printFile(url, stampedName(sub.fileName), token))} /></View>
      </View>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

// Actions for a cleared document: its stamped copy when there is one (download or print), otherwise the original.
function ClearedActions({ sub, token }) {
  const { busy, error, run } = useBusy();
  if (sub.stampedFileId) return <StampedActions sub={sub} token={token} />;
  return (
    <View>
      <SolidButton icon="download-outline" title="Download" busy={busy} onPress={() => run(() => downloadAndShare(`${apiBaseUrl}/api/files/${sub.fileId}`, sub.fileName, token, sub.mimeType))} />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function ClearedScreen({ app, params }) {
  const { data, error } = useClearance(app, params.clearanceId);
  const { busy, error: downloadError, run } = useBusy();
  if (!data) return <Loading title="Cleared" error={error} onBack={app.back} />;
  const clearance = data.clearance;
  const { stage, requirement } = findRequirement(clearance, params.requirementId);
  const sub = requirement.submission;
  const files = clearance.stages.flatMap((item) => item.requirements).filter((item) => item.status === 'cleared' && item.submission?.fileId).map((item) => (item.submission.stampedFileId ? { fileId: item.submission.stampedFileId, fileName: item.submission.fileName || item.name, stamped: true } : { fileId: item.submission.fileId, fileName: item.submission.fileName || item.name, stamped: false }));
  const next = clearance.stages.find((item) => item.status !== 'cleared');
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title={`${stage.name} Clearance`} onBack={app.back} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <View style={{ alignItems: 'center', marginVertical: 14 }}>
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={44} color="white" /></View>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#15803d', marginTop: 14 }}>Cleared!</Text>
          <Text style={{ fontSize: 16, color: MUTED, marginTop: 6, textAlign: 'center' }}>Your {requirement.name} has been approved.</Text>
        </View>
        <Card style={{ marginBottom: 16 }}>
          {sub?.fileName ? <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}><Ionicons name="document-text-outline" size={20} color={PURPLE} style={{ marginRight: 12 }} /><View style={{ flex: 1 }}><Text style={{ fontSize: 13, color: MUTED }}>Your uploaded file</Text><Text style={{ fontSize: 15, fontWeight: '600', color: INK }}>{sub.fileName}</Text></View></View> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Ionicons name="person-outline" size={18} color={MUTED} style={{ marginRight: 12 }} />
            <View><Text style={{ fontSize: 13, color: MUTED }}>Approved by</Text><Text style={{ fontSize: 15, fontWeight: '600', color: INK }}>{sub?.reviewer || stage.name}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="calendar-outline" size={18} color={MUTED} style={{ marginRight: 12 }} />
            <View><Text style={{ fontSize: 13, color: MUTED }}>Date & time</Text><Text style={{ fontSize: 15, fontWeight: '600', color: INK }}>{formatDate(sub?.reviewedAt)}</Text></View>
          </View>
        </Card>
        {sub?.stampedFileId ? <View style={{ marginBottom: 12 }}><Text style={{ fontSize: 14, color: MUTED, marginBottom: 8, textAlign: 'center' }}>Your approved PDF includes the institution stamp and reviewer signature when provided.</Text><SolidButton variant="outline" icon="eye-outline" title="View Stamped Copy" onPress={() => run(() => printFile(`${apiBaseUrl}/api/files/${sub.stampedFileId}`, stampedName(sub.fileName), app.token))} /></View> : null}
        {sub?.fileId ? <View style={{ marginBottom: 10 }}><SolidButton variant="outline" title="View Details" onPress={() => app.replace('requirement', { clearanceId: clearance.id, requirementId: requirement.id })} /></View> : null}
        <SolidButton title={next ? 'Continue to Next Step' : 'View Clearance'} onPress={() => (clearance.status === 'completed' ? app.replace('completed', { id: clearance.id }) : app.back())} />
      </ScrollView>
      {sub?.fileId ? <View style={{ padding: 12, borderTopWidth: 1, borderColor: LINE, backgroundColor: 'white' }}>
        <ErrorText>{downloadError}</ErrorText>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><SolidButton icon="download-outline" title="Download" busy={busy} onPress={() => run(() => (sub.stampedFileId ? downloadAndShare(`${apiBaseUrl}/api/files/${sub.stampedFileId}`, stampedName(sub.fileName), app.token, 'application/pdf') : downloadAndShare(`${apiBaseUrl}/api/files/${sub.fileId}`, sub.fileName, app.token, sub.mimeType)))} /></View>
        </View>
      </View> : null}
    </View>
  );
}

// ---------- Completed ----------
export function CompletedScreen({ app, params }) {
  const { data, error } = useClearance(app, params.id);
  const { busy, error: actionError, run } = useBusy();
  if (!data) return <Loading title="Clearance" error={error} onBack={app.back} />;
  const { clearance, student } = data;
  const completion = clearance.completion || {};
  const certificate = () => run(async () => {
    await shareHtml(`<html><body style="font-family:Helvetica;text-align:center;padding:60px"><h1 style="color:#5a17c9">${student.institutionName}</h1><h2>Clearance Certificate</h2><p>This certifies that</p><h1>${student.name}</h1><p>${student.programme} · ${student.level} Level</p><p>has successfully completed <b>${clearance.name} ${clearance.session}</b></p><p>Completed: ${formatDate(clearance.completedAt)}</p><p style="color:#6e6b91">Clearance ID: ${student.clearanceId}</p></body></html>`);
  });
  const idReady = completion.idCard?.status === 'Ready to View';
  const items = [
    completion.idCard && { key: 'id', icon: 'id-card-outline', title: completion.idCard.title, badge: completion.idCard.status, tone: idReady ? ['#dcfce7', '#15803d'] : ['#fef3c7', '#b45309'], onPress: () => app.go('idcard') },
    completion.matric && { key: 'matric', icon: 'school-outline', title: completion.matric.title, badge: completion.matric.status, tone: completion.matric.value ? ['#dcfce7', '#15803d'] : ['#ede9fe', PURPLE] },
    completion.certificate && { key: 'cert', icon: 'ribbon-outline', title: completion.certificate.title, badge: completion.certificate.status, tone: ['#dcfce7', '#15803d'], onPress: certificate },
    ...(completion.documents || []).map((document) => ({
      key: `doc-${document.id}`, icon: 'document-text-outline', title: document.title, badge: 'Available', tone: ['#dcfce7', '#15803d'],
      onPress: () => run(() => downloadAndShare(`${apiBaseUrl}/api/files/${document.fileId}`, document.fileName || document.title, app.token, document.mimeType)),
    })),
  ].filter(Boolean);
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="" onBack={app.back} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 60 }}>🎉</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: INK, marginTop: 6 }}>Clearance Completed!</Text>
          <Text style={{ fontSize: 16, color: MUTED, marginTop: 6, textAlign: 'center' }}>You have successfully completed your {clearance.name}.</Text>
          {clearance.completedAt ? <Text style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>Completed {formatDate(clearance.completedAt)} · 100%</Text> : null}
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', color: INK, marginBottom: 10 }}>Completion Actions</Text>
        <Card style={{ padding: 0 }}>
          {items.map((item, index) => (
            <Pressable key={item.key} onPress={item.onPress} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderTopWidth: index ? 1 : 0, borderTopColor: LINE }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#f0edff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name={item.icon} size={18} color={PURPLE} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: INK, marginBottom: 4 }}>{item.title}</Text>
                <View style={{ alignSelf: 'flex-start', backgroundColor: item.tone[0], borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ fontSize: 13, fontWeight: '700', color: item.tone[1] }}>{item.badge}</Text></View>
              </View>
              {item.onPress ? <Ionicons name="chevron-forward" size={18} color="#8b87a6" /> : null}
            </Pressable>
          ))}
        </Card>
        {items.length === 0 ? <Text style={{ fontSize: 15, color: MUTED, marginTop: -4 }}>Your institution has not set any completion actions yet.</Text> : null}
        {completion.custom ? (
          <Card style={{ marginTop: 14, backgroundColor: '#faf8ff', flexDirection: 'row' }}>
            <Ionicons name="information-circle" size={20} color={PURPLE} style={{ marginRight: 10, marginTop: 1 }} />
            <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '700', color: INK, marginBottom: 3 }}>Instructions from your institution</Text><Text style={{ fontSize: 15, lineHeight: 18, color: MUTED }}>{completion.custom}</Text></View>
          </Card>
        ) : null}
        <ErrorText>{actionError}</ErrorText>
        <View style={{ marginTop: 18 }}><SolidButton variant="outline" title="View Requirements" onPress={() => app.replace('clearance', { id: clearance.id })} busy={busy} /></View>
      </ScrollView>
    </View>
  );
}

// ---------- Student ID card (as delivered by the institution) ----------
function OfficialIdCard({ app, info }) {
  const { busy, error, run } = useBusy();
  const url = info.fileId ? `${apiBaseUrl}/api/files/${info.fileId}` : '';
  const isImage = info.mimeType?.startsWith('image/');
  const fileName = info.fileName || 'student-id-card';
  const print = () => run(async () => {
    if (isImage) {
      const dataUrl = await fetchDataUrl(info.fileId, app.token);
      await Print.printAsync({ html: `<html><body style="margin:0;text-align:center"><img src="${dataUrl}" style="max-width:100%"/></body></html>` });
    } else await printFile(url, fileName, app.token);
  });
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Student ID Card" onBack={app.back} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {info.digital ? (
          info.fileId ? (
            <>
              <View style={{ alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: INK }}>Your student ID card is ready</Text>
              </View>
              <Card style={{ padding: 8, alignItems: 'center', marginBottom: 16 }}>
                {isImage ? <Image source={fileSource(info.fileId, app.token)} resizeMode="contain" style={{ width: '100%', height: 260 }} /> : (
                  <View style={{ alignItems: 'center', paddingVertical: 34 }}><Ionicons name="document" size={54} color={PURPLE} /><Text style={{ marginTop: 8, fontSize: 15, color: MUTED }}>{fileName}</Text></View>
                )}
              </Card>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><SolidButton icon="download-outline" title="Download" busy={busy} onPress={() => run(() => downloadAndShare(url, fileName, app.token, info.mimeType))} /></View>
                <View style={{ flex: 1 }}><SolidButton variant="outline" icon="print-outline" title="Print" busy={busy} onPress={print} /></View>
              </View>
            </>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 28, marginBottom: 16 }}>
              <Ionicons name="hourglass-outline" size={38} color="#d97706" />
              <Text style={{ marginTop: 10, fontSize: 17, fontWeight: '700', color: INK }}>Your ID card is being prepared</Text>
              <Text style={{ marginTop: 4, fontSize: 15, color: MUTED, textAlign: 'center' }}>You will be notified as soon as your institution uploads it.</Text>
            </Card>
          )
        ) : null}
        {info.physical ? (
          <Card style={{ marginTop: info.digital ? 18 : 0, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="business-outline" size={20} color={PURPLE} style={{ marginRight: 8 }} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: INK }}>Ready for Collection</Text>
            </View>
            {[['Location', info.location], ['Collection Date', info.date], ['Office Hours', info.hours], ['Instructions', info.instructions]].filter(([, value]) => value).map(([label, value]) => (
              <View key={label} style={{ marginBottom: 8 }}><Text style={{ fontSize: 13, color: MUTED }}>{label}</Text><Text style={{ fontSize: 16, color: INK }}>{value}</Text></View>
            ))}
            {!info.location && !info.date && !info.hours && !info.instructions ? <Text style={{ fontSize: 15, color: MUTED }}>Your institution will share the collection details soon.</Text> : null}
          </Card>
        ) : null}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
    </View>
  );
}

export function IdCardScreen({ app }) {
  const student = app.overview.student;
  const clearance = app.overview.clearances.find((item) => item.status === 'completed' && item.completion?.idCard);
  const passport = app.overview.clearances.flatMap((item) => item.stages).flatMap((stage) => stage.requirements).find((item) => item.id === 'passport-photo' && item.submission?.fileId && item.submission.mimeType.startsWith('image/'));
  const { busy, error, run } = useBusy();
  const info = clearance?.completion?.idCard;
  const download = () => run(async () => {
    const photo = passport ? await fetchDataUrl(passport.submission.fileId, app.token) : '';
    await shareHtml(`<html><body style="font-family:Helvetica;padding:40px"><div style="width:340px;border:2px solid #5a17c9;border-radius:16px;padding:20px"><div style="color:#5a17c9;font-weight:bold">${student.institutionName}</div><div style="font-size:10px;color:#6e6b91;margin-bottom:12px">STUDENT IDENTITY CARD</div><div style="display:flex;gap:14px">${photo ? `<img src="${photo}" style="width:110px;height:130px;object-fit:cover;border-radius:8px"/>` : '<div style="width:110px;height:130px;background:#ede9fe;border-radius:8px"></div>'}${qrSvg(student.clearanceId)}</div><h3 style="margin:14px 0 4px">${student.name}</h3><div style="font-size:12px;color:#6e6b91">Matric No: ${student.matricNo || '---------'}<br/>${student.programme}<br/>${student.level} Level</div></div></body></html>`);
  });
  const share = () => Share.share({ message: `${student.name} — ${student.institutionName} student ID (${student.clearanceId})` });
  // Institution-configured delivery (digital upload and/or physical collection) replaces the sample layout below.
  if (info && info.digital !== undefined) return <OfficialIdCard app={app} info={info} />;
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Student ID Card" onBack={app.back} />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#faf8ff', borderBottomWidth: 1, borderBottomColor: LINE }}>
            <InstitutionMark size={38} />
            <View style={{ marginLeft: 10 }}><Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>{student.institutionName}</Text><Text style={{ fontSize: 12, color: MUTED, letterSpacing: 0.5 }}>STUDENT IDENTITY CARD</Text></View>
          </View>
          <View style={{ flexDirection: 'row', padding: 14, alignItems: 'flex-start' }}>
            {passport ? <Image source={fileSource(passport.submission.fileId, app.token)} style={{ width: 96, height: 112, borderRadius: 10, backgroundColor: '#f3f0fd' }} /> : <View style={{ width: 96, height: 112, borderRadius: 10, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={40} color={PURPLE} /></View>}
            <View style={{ flex: 1, alignItems: 'flex-end' }}><QRCodeSvg value={student.clearanceId} size={96} color={INK} /></View>
          </View>
          <View style={{ paddingHorizontal: 14, paddingBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: INK }}>{shortName(student.name)}</Text>
            <Text style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>Matric No: {student.matricNo || '---------'}</Text>
            <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{student.programme}</Text>
            <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{student.level} Level</Text>
          </View>
        </Card>
        {info ? (
          <Card style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: INK, marginBottom: 8 }}>{info.status}</Text>
            {[['Location', info.location], ['Collection Date', info.date], ['Office Hours', info.hours], ['Instructions', info.instructions]].map(([label, value]) => (
              <View key={label} style={{ marginBottom: 6 }}><Text style={{ fontSize: 13, color: MUTED }}>{label}</Text><Text style={{ fontSize: 15, color: INK }}>{value}</Text></View>
            ))}
          </Card>
        ) : null}
        <ErrorText>{error}</ErrorText>
        <SolidButton icon="download-outline" title="Download ID Card" onPress={download} busy={busy} />
        <View style={{ height: 10 }} />
        <SolidButton variant="outline" icon="share-social-outline" title="Share" onPress={share} />
      </ScrollView>
    </View>
  );
}
