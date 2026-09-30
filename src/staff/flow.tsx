import { useEffect, useState } from 'react';
import KeyboardScreen from '../components/KeyboardScreen';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { downloadAndShare, stampedName } from '../components/downloadFile';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiBaseUrl, apiRequest } from '../api';
import { Card, ErrorText, INK, LINE, MUTED, PURPLE, ScreenHeader, SolidButton, StatusBadge, formatDate, formatSize, timeAgo, useBusy } from './ui';
import * as ImagePicker from 'expo-image-picker';
import PdfView from '../components/PdfView';
import useAuthImage from '../components/useAuthImage';
import { Input } from '../institution/ui';
import { Avatar } from './screens';

const REASONS = ['Document is unreadable', 'Wrong document', 'Incomplete document', 'Information does not match', 'Other'];
const TYPE = { 'application/pdf': 'PDF', 'image/png': 'Image', 'image/jpeg': 'Image' };
const fileUrl = (fileId) => `${apiBaseUrl}/api/staff/files/${fileId}`;

export function useStudent(app, id) {
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    let live = true;
    apiRequest(`/api/staff/students/${id}`, undefined, app.token)
      .then((data) => live && setState({ data, error: '' }))
      .catch((cause) => live && setState({ data: null, error: cause.message }));
    return () => { live = false; };
  }, [id, app.version]);
  return state;
}

function Loading({ title, error, onBack }) {
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title={title} onBack={onBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {error ? <View style={{ width: '100%' }}><ErrorBanner message={error} /></View> : <ActivityIndicator color={PURPLE} />}
      </View>
    </View>
  );
}

function StudentHeader({ student, token, badge }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 }}>
      <Avatar name={student.name} fileId={student.photoFileId} token={token} size={64} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: INK }}>{student.name}</Text>
        <Text style={{ fontSize: 15, color: PURPLE, marginTop: 1 }}>{student.clearanceId}</Text>
        <Text style={{ fontSize: 15, color: MUTED, marginTop: 1 }}>{student.department} • {student.level} Level</Text>
        {badge ? <View style={{ marginTop: 6 }}>{badge}</View> : null}
      </View>
    </View>
  );
}

const groupBadge = (group) => {
  if (group === 'pending') return <StatusBadge status="pending" />;
  if (group === 'action') return <StatusBadge status="action_required" />;
  if (group === 'cleared') return <StatusBadge status="cleared" />;
  return <StatusBadge status="in_progress" />;
};
const pendingDocs = (data) => data.documents.filter((doc) => ['pending', 'resubmitted'].includes(doc.submission?.status));
const submittedDocs = (data) => data.documents.filter((doc) => doc.submission);
const docLine = (sub) => `${TYPE[sub.mimeType] || 'File'} • ${formatSize(sub.size)} • ${formatDate(sub.submittedAt).split(',')[0]}`;

// ---------- Student details ----------
export function StudentDetailsScreen({ app, params }) {
  const { data, error } = useStudent(app, params.id);
  const [tab, setTab] = useState('Details');
  if (!data) return <Loading title="Student Details" error={error} onBack={app.back} />;
  const { student } = data;
  const pending = pendingDocs(data).length;
  const rows = [['JAMB Registration', student.jamb], ['Programme', student.programme], ['Faculty', student.faculty], ['Level', `${student.level} Level`], ['Admission Year', student.admissionYear], ['Email', student.email], ['Phone Number', student.phone]];
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Student Details" onBack={app.back} />
      <StudentHeader student={student} token={app.token} badge={groupBadge(student.group)} />
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, marginHorizontal: 18 }}>
        {['Details', 'Submissions', 'History'].map((name) => (
          <Pressable key={name} onPress={() => setTab(name)} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: tab === name ? PURPLE : 'transparent' }}>
            <Text style={{ fontSize: 16, fontWeight: tab === name ? '700' : '500', color: tab === name ? PURPLE : MUTED }}>{name}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16 }}>
        {tab === 'Details' ? rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E1F5' }}>
            <Text style={{ fontSize: 15, color: MUTED }}>{label}</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: INK, flexShrink: 1, textAlign: 'right', marginLeft: 16 }}>{value}</Text>
          </View>
        )) : null}
        {tab === 'Submissions' ? data.documents.map((doc) => (
          <View key={doc.requirementId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#E5E1F5' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>{doc.name}</Text>
              <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{doc.submission ? docLine(doc.submission) : 'Not submitted'}</Text>
            </View>
            <StatusBadge status={{ pending: 'pending', resubmitted: 'resubmitted', cleared: 'cleared', rejected: 'action_required' }[doc.submission?.status] || 'not_started'} />
          </View>
        )) : null}
        {tab === 'History' ? (
          <View style={{ paddingTop: 12 }}>
            {data.history.length === 0 ? <Text style={{ color: MUTED, textAlign: 'center', marginTop: 30 }}>No activity yet.</Text> : null}
            {data.history.map((event) => (
              <View key={event.id} style={{ flexDirection: 'row', marginBottom: 16 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PURPLE, marginTop: 4, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: INK }}>{event.title}</Text>
                  {event.detail ? <Text style={{ fontSize: 14, color: MUTED, marginTop: 1 }}>{event.detail}</Text> : null}
                  <Text style={{ fontSize: 13, color: '#9a97b5', marginTop: 2 }}>{formatDate(event.at)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ padding: 18, paddingTop: 6 }}>
        <SolidButton icon="arrow-forward" iconSide="right" title="Review Submission" onPress={() => app.go('documents', { id: student.id })} />
      </View>
    </View>
  );
}

// ---------- Submitted documents ----------
// A cleared document downloads as its stamped PDF copy when one exists; anything else downloads the original upload.
async function downloadDocument(doc, token) {
  const sub = doc.submission;
  if (sub.stampedFileId) await downloadAndShare(fileUrl(sub.stampedFileId), stampedName(sub.fileName), token, 'application/pdf');
  else await downloadAndShare(fileUrl(sub.fileId), sub.fileName, token, sub.mimeType);
}

const STATUS_ICON = { cleared: ['checkmark-circle', '#16a34a'], rejected: ['close-circle', '#dc2626'], pending: ['time', '#f59e0b'], resubmitted: ['time', '#f59e0b'] };

export function DocumentsScreen({ app, params }) {
  const { data, error } = useStudent(app, params.id);
  const { busy, error: downloadError, run } = useBusy();
  if (!data) return <Loading title="Submitted Documents" error={error} onBack={app.back} />;
  const docs = submittedDocs(data);
  const pending = pendingDocs(data).length;
  return (
    <View style={{ flex: 1, backgroundColor: '#fbfaff' }}>
      <ScreenHeader title="Submitted Documents" onBack={app.back} tint="#fbfaff" />
      <ScrollView contentContainerStyle={{ padding: 18 }}>
        {docs.map((doc, index) => {
          const sub = doc.submission;
          return (
            <Card key={doc.requirementId} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="checkmark-circle" size={26} color="#16a34a" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', fontWeight: '700', color: INK }}>{doc.name}</Text>
                  <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{docLine(sub)}</Text>
                </View>
                <StatusBadge status={{ pending: 'pending', resubmitted: 'resubmitted', cleared: 'cleared', rejected: 'action_required' }[sub.status] || 'pending'} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 92, height: 68, borderRadius: 10, backgroundColor: '#f3f0fd', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {sub.mimeType.startsWith('image/') ? <Image source={{ uri: fileUrl(sub.fileId), headers: { Authorization: `Bearer ${app.token}` } }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <PdfView mode="thumb" url={fileUrl(sub.fileId)} token={app.token} style={{ width: '100%', height: '100%' }} />}
                </View>
                <Pressable onPress={() => app.go('view', { id: params.id, index })} style={{ flex: 1, marginLeft: 12, height: 50, borderRadius: 12, borderWidth: 2, borderColor: '#CBBFF5', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '700', color: PURPLE, fontSize: 16 }}>View</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Download ${doc.name}`} onPress={() => run(() => downloadDocument(doc, app.token))} style={{ marginLeft: 8, width: 50, height: 50, borderRadius: 12, borderWidth: 2, borderColor: '#CBBFF5', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="download-outline" size={22} color={PURPLE} />
                </Pressable>
              </View>
            </Card>
          );
        })}
        {docs.length === 0 ? <Text style={{ textAlign: 'center', color: MUTED, fontSize: 15, lineHeight: 22, marginTop: 40 }}>This student hasn’t submitted any documents for you to review yet.</Text> : null}
        <ErrorText>{downloadError}</ErrorText>
      </ScrollView>
      {pending ? <View style={{ padding: 18, paddingTop: 6 }}><SolidButton icon="arrow-forward" iconSide="right" title="Take Action" busy={busy} onPress={() => app.go('action', { id: params.id })} /></View> : null}
    </View>
  );
}

// ---------- View a document ----------
export function ViewDocumentScreen({ app, params }) {
  const { data, error } = useStudent(app, params.id);
  const [index, setIndex] = useState(params.index || 0);
  const [zoom, setZoom] = useState(1);
  const { busy, error: downloadError, run } = useBusy();
  if (!data) return <Loading title="View Document" error={error} onBack={app.back} />;
  const docs = submittedDocs(data);
  const doc = docs[index];
  const sub = doc.submission;
  const isImage = sub.mimeType.startsWith('image/');
  const step = (delta) => { setIndex((index + delta + docs.length) % docs.length); setZoom(1); };
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="View Document" onBack={app.back} />
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 12 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold', fontWeight: '700', color: INK }}>{sub.fileName}</Text>
        {docs.length > 1 ? <Pressable accessibilityLabel="Previous document" onPress={() => step(-1)} style={{ padding: 4 }}><Ionicons name="chevron-back" size={20} color={MUTED} /></Pressable> : null}
        <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: MUTED }}>{index + 1} of {docs.length}</Text>
        {docs.length > 1 ? <Pressable accessibilityLabel="Next document" onPress={() => step(1)} style={{ padding: 4 }}><Ionicons name="chevron-forward" size={20} color={MUTED} /></Pressable> : null}
      </View>
      <View style={{ flex: 1, backgroundColor: '#3f4a66' }}>
        {isImage ? (
          <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: fileUrl(sub.fileId), headers: { Authorization: `Bearer ${app.token}` } }} resizeMode="contain" style={{ width: 320 * zoom, height: 420 * zoom }} />
            </ScrollView>
          </ScrollView>
        ) : (
          <PdfView mode="full" url={fileUrl(sub.fileId)} token={app.token} zoom={zoom} style={{ flex: 1 }} />
        )}
      </View>
      <View style={{ padding: 18, paddingTop: 14, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: LINE }}>
        {true ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => setZoom(Math.max(0.5, zoom - 0.25))} style={{ width: 64, height: 54, borderRadius: 13, borderWidth: 2, borderColor: '#CBBFF5', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="remove" size={26} color={PURPLE} /></Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 18, fontFamily: 'Inter_700Bold', fontWeight: '700', color: INK }}>{Math.round(zoom * 100)}%</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => setZoom(Math.min(3, zoom + 0.25))} style={{ width: 64, height: 54, borderRadius: 13, borderWidth: 2, borderColor: '#CBBFF5', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={26} color={PURPLE} /></Pressable>
          </View>
        ) : null}
        <ErrorText>{downloadError}</ErrorText>
        <SolidButton icon="download-outline" title="Download" busy={busy} onPress={() => run(() => downloadDocument(doc, app.token))} />
      </View>
    </View>
  );
}

// ---------- Take action ----------
export function TakeActionScreen({ app, params }) {
  const { data, error } = useStudent(app, params.id);
  const [decision, setDecision] = useState('clear');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const { busy, error: actionError, setError, run } = useBusy();
  // The reviewer's stamp / signature, shown so they can see what a cleared document will carry.
  const [stamp, setStamp] = useState(undefined);
  const [stampVersion, setStampVersion] = useState(0);
  const [stampError, setStampError] = useState('');
  const stampImage = useAuthImage(stamp ? `${apiBaseUrl}/api/staff/stamp/image` : null, app.token, stampVersion);
  useEffect(() => {
    let live = true;
    apiRequest('/api/staff/stamp', undefined, app.token).then((result) => live && setStamp(result.stamp || null)).catch(() => live && setStamp(null));
    return () => { live = false; };
  }, []);
  const uploadStamp = async () => {
    setStampError('');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType || (/\.png$/i.test(asset.uri) ? 'image/png' : 'image/jpeg');
    if (!['image/png', 'image/jpeg'].includes(mimeType)) { setStampError('Please choose a PNG or JPG image.'); return; }
    if (asset.fileSize && asset.fileSize > 1.5 * 1024 * 1024) { setStampError('The image must be under 1.5MB.'); return; }
    try {
      const blob = await (await fetch(asset.uri)).blob();
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onloadend = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Could not read the selected image.')); reader.readAsDataURL(blob); });
      const saved = await apiRequest('/api/staff/stamp', { name: asset.fileName || 'stamp', mimeType, base64 }, app.token, 'PUT');
      setStamp(saved.stamp); setStampVersion((value) => value + 1);
    } catch (cause) { setStampError(cause.message); }
  };
  if (!data) return <Loading title="Take Action" error={error} onBack={app.back} />;
  const pending = pendingDocs(data);
  const chosen = selected || pending.map((doc) => doc.requirementId);
  const toggle = (id) => setSelected(chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id]);
  const confirm = () => run(async () => {
    await apiRequest('/api/staff/review', { studentId: params.id, decision: 'clear', message: note, requirementIds: pending.map((doc) => doc.requirementId) }, app.token);
    app.bump();
    app.backTo('student');
  });
  const reject = () => {
    if (!reason) { setError('Select a reason.'); return; }
    if (!message.trim()) { setError('Add a message for the student.'); return; }
    if (!chosen.length) { setError('Select at least one document.'); return; }
    return run(async () => {
      await apiRequest('/api/staff/review', { studentId: params.id, decision: 'reject', reason, message, requirementIds: chosen }, app.token);
      app.bump();
      app.backTo('student');
    });
  };
  const pick = (value) => { setDecision(value); setError(''); };
  const Option = ({ value, icon, color, title, text }) => (
    <Pressable onPress={() => pick(value)} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 2, marginBottom: 12, borderColor: decision === value ? color : LINE, backgroundColor: decision === value ? (value === 'clear' ? '#EDFBF4' : '#FFF1F4') : 'white' }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: color, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Ionicons name={icon} size={24} color="white" /></View>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>{title}</Text><Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>{text}</Text></View>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: decision === value ? color : '#c9c5dc', alignItems: 'center', justifyContent: 'center' }}>{decision === value ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} /> : null}</View>
    </Pressable>
  );
  const box = { height: 116, borderRadius: 12, borderWidth: 2, borderColor: '#D2CAF1', padding: 14, fontSize: 16, color: INK, fontFamily: 'Inter_500Medium' } as const;
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Take Action" onBack={app.back} />
      <KeyboardScreen contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <StudentHeader student={data.student} token={app.token} />
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: INK, marginVertical: 10 }}>Decision</Text>
          <Option value="clear" icon="checkmark" color="#16a34a" title="Clear Student" text="Mark this submission as approved." />
          <Option value="reject" icon="close" color="#ef4444" title="Reject / Request Re-upload" text="Send back to student with a reason." />
          <Text style={{ fontSize: 14, color: MUTED, marginBottom: 8 }}>Applies to {pending.length} pending document{pending.length === 1 ? '' : 's'}.</Text>
          {decision === 'clear' ? (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: INK, marginVertical: 8 }}>Add a note (Optional)</Text>
              <TextInput value={note} onChangeText={setNote} multiline placeholder="e.g. All documents are valid." placeholderTextColor="#a4a1bc" textAlignVertical="top" style={box} />
              <Card style={{ marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {stamp ? (
                    <>
                      <View style={{ width: 96, height: 64, borderRadius: 10, backgroundColor: '#f3f0fd', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 14 }}>
                        {stampImage.uri ? <Image source={{ uri: stampImage.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : stampImage.failed ? <Ionicons name="alert-circle-outline" size={28} color="#dc2626" /> : <ActivityIndicator color={PURPLE} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>Your stamp / signature</Text>
                        <Text style={{ fontSize: 14, color: stampImage.failed ? '#dc2626' : MUTED, marginTop: 2 }}>{stampImage.failed ? 'Saved, but the picture could not be loaded. Try Replace stamp.' : 'Will be stamped on each document you clear.'}</Text>
                      </View>
                    </>
                  ) : stamp === null ? (
                    <>
                      <View style={{ width: 96, height: 64, borderRadius: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cfc6f2', backgroundColor: '#faf8ff', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}><Ionicons name="ribbon-outline" size={28} color="#b9a4f2" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: INK }}>No stamp or signature yet</Text>
                        <Text style={{ fontSize: 14, color: MUTED, marginTop: 2 }}>Add one and it appears here.</Text>
                      </View>
                    </>
                  ) : <ActivityIndicator color={PURPLE} />}
                </View>
                {stamp !== undefined ? <View style={{ marginTop: 12 }}><SolidButton variant="outline" icon="cloud-upload-outline" title={stamp ? 'Replace stamp' : 'Add stamp'} onPress={uploadStamp} /></View> : null}
                {stampError ? <View style={{ marginTop: 10 }}><ErrorText>{stampError}</ErrorText></View> : null}
              </Card>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 18, fontWeight: '700', color: INK, marginTop: 10, marginBottom: 4 }}>Reason <Text style={{ color: '#ef4444' }}>*</Text></Text>
              {REASONS.map((item) => (
                <Pressable key={item} onPress={() => { setReason(item); setError(''); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: reason === item ? PURPLE : '#c9c5dc', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{reason === item ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: PURPLE }} /> : null}</View>
                  <Text style={{ fontSize: 16, color: INK }}>{item}</Text>
                </Pressable>
              ))}
              <Text style={{ fontSize: 18, fontWeight: '700', color: INK, marginTop: 14, marginBottom: 8 }}>Additional message <Text style={{ color: '#ef4444' }}>*</Text></Text>
              <TextInput value={message} onChangeText={(value) => { setMessage(value); setError(''); }} multiline placeholder="Explain what the student should fix." placeholderTextColor="#a4a1bc" textAlignVertical="top" style={box} />
              {pending.length > 1 ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: INK, marginBottom: 6 }}>Documents to reject</Text>
                  {pending.map((doc) => (
                    <Pressable key={doc.requirementId} onPress={() => toggle(doc.requirementId)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                      <Ionicons name={chosen.includes(doc.requirementId) ? 'checkbox' : 'square-outline'} size={24} color={PURPLE} style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 16, color: INK }}>{doc.name}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </>
          )}
          <View style={{ marginTop: 10 }}><ErrorText>{actionError}</ErrorText></View>
        </View>
      </KeyboardScreen>
      <View style={{ padding: 18, paddingTop: 6 }}>
        {decision === 'clear'
          ? <SolidButton icon="arrow-forward" iconSide="right" title="Confirm Clearance" busy={busy} onPress={confirm} />
          : <SolidButton variant="danger" icon="arrow-forward" iconSide="right" title="Reject & Request Re-upload" busy={busy} onPress={reject} />}
      </View>
    </View>
  );
}

// ---------- Reject ----------
export function RejectScreen({ app, params }) {
  const { data, error } = useStudent(app, params.id);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState(null);
  const { busy, error: rejectError, setError, run } = useBusy();
  if (!data) return <Loading title="Reject Submission" error={error} onBack={app.back} />;
  const pending = pendingDocs(data);
  const chosen = selected || pending.map((doc) => doc.requirementId);
  const toggle = (id) => setSelected(chosen.includes(id) ? chosen.filter((item) => item !== id) : [...chosen, id]);
  const submit = () => {
    if (!reason) { setError('Select a reason.'); return; }
    if (!message.trim()) { setError('Add a message for the student.'); return; }
    if (!chosen.length) { setError('Select at least one document.'); return; }
    return run(async () => {
      await apiRequest('/api/staff/review', { studentId: params.id, decision: 'reject', reason, message, requirementIds: chosen }, app.token);
      app.bump();
      app.backTo('student');
    });
  };
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Reject Submission" onBack={app.back} />
      <KeyboardScreen contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <StudentHeader student={data.student} token={app.token} />
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: INK, marginVertical: 10 }}>Reason <Text style={{ color: '#ef4444' }}>*</Text></Text>
          {REASONS.map((item) => (
            <Pressable key={item} onPress={() => setReason(item)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: reason === item ? PURPLE : '#c9c5dc', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{reason === item ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: PURPLE }} /> : null}</View>
              <Text style={{ fontSize: 16, color: INK }}>{item}</Text>
            </Pressable>
          ))}
          <Text style={{ fontSize: 17, fontWeight: '700', color: INK, marginTop: 14, marginBottom: 8 }}>Additional message <Text style={{ color: '#ef4444' }}>*</Text></Text>
          <TextInput value={message} onChangeText={setMessage} multiline placeholder="Explain what the student should fix." placeholderTextColor="#a4a1bc" textAlignVertical="top" style={{ height: 116, borderRadius: 12, borderWidth: 2, borderColor: '#D2CAF1', padding: 14, fontSize: 17, color: INK, fontFamily: 'Inter_500Medium' }} />
          {pending.length > 1 ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 }}>Documents to reject</Text>
              {pending.map((doc) => (
                <Pressable key={doc.requirementId} onPress={() => toggle(doc.requirementId)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                  <Ionicons name={chosen.includes(doc.requirementId) ? 'checkbox' : 'square-outline'} size={20} color={PURPLE} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 16, color: INK }}>{doc.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 10 }}><ErrorText>{rejectError}</ErrorText></View>
        </View>
      </KeyboardScreen>
      <View style={{ padding: 18, paddingTop: 6 }}>
        <SolidButton variant="danger" icon="arrow-forward" iconSide="right" title="Reject & Request Re-upload" busy={busy} onPress={submit} />
      </View>
    </View>
  );
}

// ---------- Create a clearance (officers) ----------
const EXAMPLE = { name: 'Hostel Clearance', description: 'Upload these documents to get your hostel space.', documents: ['Hostel Application Form', 'Passport Photograph', 'Caution Fee Receipt'] };
const labelStyle = { marginBottom: 8, fontSize: 15, color: INK, fontFamily: 'Inter_700Bold', fontWeight: '700' } as const;

export function CreateClearanceScreen({ app }) {
  const { staff } = app.overview;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [documents, setDocuments] = useState(['']);
  const [tried, setTried] = useState(false);
  const { busy, error, setError, run } = useBusy();
  const setDocument = (index, value) => setDocuments((current) => current.map((item, at) => (at === index ? value : item)));
  const missing = !name.trim() || documents.some((item) => !item.trim());
  const useExample = () => { setName(EXAMPLE.name); setDescription(EXAMPLE.description); setDocuments([...EXAMPLE.documents]); setTried(false); setError(''); };
  const submit = () => {
    setTried(true);
    if (missing) { setError('Some fields are empty. Fill in the ones marked in red.'); return; }
    return run(async () => {
      // The clearance is one list of documents; the server keeps it as a single stage.
      await apiRequest('/api/staff/clearances', { name, description, stages: [{ name: 'Documents', requirements: documents.map((item) => ({ name: item })) }] }, app.token);
      app.bump();
      app.back();
    });
  };
  const field = (invalid) => ({ minHeight: 56, paddingHorizontal: 14, borderWidth: 2, borderColor: invalid ? '#EF4444' : '#D2CAF1', borderRadius: 12, backgroundColor: invalid ? '#FFFAFA' : 'white', color: INK, fontSize: 17, fontFamily: 'Inter_500Medium' });
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Create Clearance" onBack={app.back} />
      <KeyboardScreen contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Card style={{ marginBottom: 18, backgroundColor: '#faf8ff' }}>
          <Text style={{ fontSize: 14, lineHeight: 21, color: MUTED }}>Name the clearance, then list the documents a student must upload. You will review what they send.</Text>
          <Text style={{ fontSize: 13, color: MUTED, marginTop: 8 }}>For {staff.scope.department} • {staff.scope.level} Level • {staff.scope.session}. Only those students will see it.</Text>
          <View style={{ marginTop: 12 }}><SolidButton variant="outline" icon="bulb-outline" title="Fill in an example" onPress={useExample} /></View>
        </Card>

        <Text style={labelStyle}>Clearance name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Hostel Clearance" placeholderTextColor="#9995B5" style={[field(tried && !name.trim()), { marginBottom: 16 }]} />

        <Text style={labelStyle}>Description <Text style={{ color: MUTED, fontFamily: 'Inter_500Medium', fontWeight: '500' }}>(optional)</Text></Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="e.g. Upload these documents to get your hostel space." placeholderTextColor="#9995B5" style={[field(false), { marginBottom: 22 }]} />

        <Text style={{ fontSize: 16, ...{ fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: INK } }}>Documents students upload</Text>
        <Text style={{ fontSize: 14, color: MUTED, marginTop: 3, marginBottom: 12 }}>Add one line for each file, e.g. “Application Form”.</Text>
        {documents.map((item, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ width: 26, fontSize: 15, fontFamily: 'Inter_700Bold', fontWeight: '700', color: MUTED }}>{index + 1}.</Text>
            <TextInput value={item} onChangeText={(value) => setDocument(index, value)} placeholder="e.g. Application Form" placeholderTextColor="#9995B5" style={[field(tried && !item.trim()), { flex: 1 }]} />
            {documents.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Remove document" onPress={() => setDocuments(documents.filter((_, at) => at !== index))} style={{ width: 40, height: 56, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close-circle" size={24} color="#B2A9DE" /></Pressable> : null}
          </View>
        ))}
        <SolidButton variant="outline" icon="add" title="Add another document" onPress={() => setDocuments([...documents, ''])} />
        <View style={{ marginTop: 14 }}><ErrorText>{error}</ErrorText></View>
      </KeyboardScreen>
      <View style={{ padding: 18, paddingTop: 8, borderTopWidth: 1, borderTopColor: LINE }}>
        <SolidButton icon="checkmark" title="Create Clearance" busy={busy} onPress={submit} />
      </View>
    </View>
  );
}
