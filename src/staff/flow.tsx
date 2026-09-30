import { useEffect, useState } from 'react';
import KeyboardScreen from '../components/KeyboardScreen';
import ErrorBanner from '../components/ErrorBanner';
import Ionicons from '@expo/vector-icons/Ionicons';
import { downloadAndShare, stampedName } from '../components/downloadFile';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { apiBaseUrl, apiRequest } from '../api';
import { PrimaryButton } from '../components/Shared';
import { Card, ErrorText, INK, LINE, MUTED, PURPLE, ScreenHeader, SolidButton, StatusBadge, formatDate, formatSize, timeAgo, useBusy } from '../student/ui';
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
      <Avatar name={student.name} fileId={student.photoFileId} token={token} size={56} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: INK }}>{student.name}</Text>
        <Text style={{ fontSize: 12, color: PURPLE, marginTop: 1 }}>{student.clearanceId}</Text>
        <Text style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{student.department} • {student.level} Level</Text>
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
          <Pressable key={name} onPress={() => setTab(name)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: tab === name ? PURPLE : 'transparent' }}>
            <Text style={{ fontSize: 13, fontWeight: tab === name ? '700' : '500', color: tab === name ? PURPLE : MUTED }}>{name}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16 }}>
        {tab === 'Details' ? rows.map(([label, value]) => (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0eef8' }}>
            <Text style={{ fontSize: 12, color: MUTED }}>{label}</Text>
            <Text style={{ fontSize: 12, fontWeight: '600', color: INK, flexShrink: 1, textAlign: 'right', marginLeft: 16 }}>{value}</Text>
          </View>
        )) : null}
        {tab === 'Submissions' ? data.documents.map((doc) => (
          <View key={doc.requirementId} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0eef8' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{doc.name}</Text>
              <Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{doc.submission ? docLine(doc.submission) : 'Not submitted'}</Text>
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
                  <Text style={{ fontSize: 13, fontWeight: '600', color: INK }}>{event.title}</Text>
                  {event.detail ? <Text style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{event.detail}</Text> : null}
                  <Text style={{ fontSize: 10, color: '#9a97b5', marginTop: 2 }}>{formatDate(event.at)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={{ padding: 18, paddingTop: 6 }}>
        {submittedDocs(data).length ? (pending ? <PrimaryButton title="Review Submission" onPress={() => app.go('documents', { id: student.id })} /> : <SolidButton variant="outline" title="View Submissions" onPress={() => app.go('documents', { id: student.id })} />) : null}
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
          const [icon, color] = STATUS_ICON[sub.status];
          return (
            <Card key={doc.requirementId} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name={icon} size={20} color={color} />
                <View style={{ marginLeft: 8, flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{doc.name}</Text>
                  <Text style={{ fontSize: 11, color: MUTED }}>{docLine(sub)}</Text>
                </View>
                {sub.stampedFileId ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Ionicons name="ribbon" size={12} color="#15803d" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#15803d' }}>Stamped</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 84, height: 62, borderRadius: 8, backgroundColor: '#f3f0fd', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {sub.mimeType.startsWith('image/') ? <Image source={{ uri: fileUrl(sub.fileId), headers: { Authorization: `Bearer ${app.token}` } }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Ionicons name="document-text" size={28} color={PURPLE} />}
                </View>
                <Pressable onPress={() => app.go('view', { id: params.id, index })} style={{ flex: 1, marginLeft: 12, height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: '#d6ccf3', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontWeight: '700', color: PURPLE, fontSize: 13 }}>View</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Download ${doc.name}`} onPress={() => run(() => downloadDocument(doc, app.token))} style={{ marginLeft: 8, width: 42, height: 42, borderRadius: 10, borderWidth: 1.5, borderColor: '#d6ccf3', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="download-outline" size={19} color={PURPLE} />
                </Pressable>
              </View>
            </Card>
          );
        })}
        <ErrorText>{downloadError}</ErrorText>
      </ScrollView>
      {pending ? <View style={{ padding: 18, paddingTop: 6 }}><PrimaryButton title={busy ? 'Please wait...' : 'Take Action'} onPress={() => app.go('action', { id: params.id })} /></View> : null}
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
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: INK }}>{sub.fileName}</Text>
        {docs.length > 1 ? <Pressable onPress={() => step(-1)} style={{ padding: 4 }}><Ionicons name="chevron-back" size={16} color={MUTED} /></Pressable> : null}
        <Text style={{ fontSize: 12, color: MUTED }}>{index + 1} of {docs.length}</Text>
        {docs.length > 1 ? <Pressable onPress={() => step(1)} style={{ padding: 4 }}><Ionicons name="chevron-forward" size={16} color={MUTED} /></Pressable> : null}
      </View>
      <View style={{ flex: 1, backgroundColor: '#3f4a66' }}>
        {isImage ? (
          <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: fileUrl(sub.fileId), headers: { Authorization: `Bearer ${app.token}` } }} resizeMode="contain" style={{ width: 320 * zoom, height: 420 * zoom }} />
            </ScrollView>
          </ScrollView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
            <Ionicons name="document-text" size={64} color="white" />
            <Text style={{ color: 'white', marginTop: 12, fontWeight: '700' }}>{doc.name}</Text>
            <Text style={{ color: '#cbd5e1', marginTop: 6, textAlign: 'center', fontSize: 12 }}>PDF preview isn’t available in the app. Use Download to open it in your PDF viewer.</Text>
          </View>
        )}
        {isImage ? (
          <View style={{ position: 'absolute', bottom: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, padding: 4 }}>
            <Pressable accessibilityLabel="Zoom out" onPress={() => setZoom(Math.max(0.5, zoom - 0.25))} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="remove" size={20} color={INK} /></Pressable>
            <Text style={{ width: 60, textAlign: 'center', fontSize: 13, color: INK }}>{Math.round(zoom * 100)}%</Text>
            <Pressable accessibilityLabel="Zoom in" onPress={() => setZoom(Math.min(3, zoom + 0.25))} style={{ width: 40, height: 36, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={20} color={INK} /></Pressable>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 18 }}>
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
  const { busy, error: actionError, run } = useBusy();
  if (!data) return <Loading title="Take Action" error={error} onBack={app.back} />;
  const pending = pendingDocs(data);
  const confirm = () => run(async () => {
    await apiRequest('/api/staff/review', { studentId: params.id, decision: 'clear', message: note, requirementIds: pending.map((doc) => doc.requirementId) }, app.token);
    app.bump();
    app.backTo('student');
  });
  const Option = ({ value, icon, color, title, text }) => (
    <Pressable onPress={() => setDecision(value)} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1.5, marginBottom: 10, borderColor: decision === value ? color : LINE, backgroundColor: decision === value ? `${color}12` : 'white' }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Ionicons name={icon} size={20} color="white" /></View>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: '700', color: INK }}>{title}</Text><Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{text}</Text></View>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: decision === value ? color : '#c9c5dc', alignItems: 'center', justifyContent: 'center' }}>{decision === value ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} /> : null}</View>
    </Pressable>
  );
  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenHeader title="Take Action" onBack={app.back} />
      <KeyboardScreen contentContainerStyle={{ paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <StudentHeader student={data.student} token={app.token} />
        <View style={{ paddingHorizontal: 18 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginVertical: 10 }}>Decision</Text>
          <Option value="clear" icon="checkmark" color="#16a34a" title="Clear Student" text="Mark this submission as approved." />
          <Option value="reject" icon="close" color="#ef4444" title="Reject / Request Re-upload" text="Send back to student with a reason." />
          <Text style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Applies to {pending.length} pending document{pending.length === 1 ? '' : 's'}.</Text>
          {decision === 'clear' ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '700', color: INK, marginVertical: 8 }}>Add a note (Optional)</Text>
              <TextInput value={note} onChangeText={setNote} multiline placeholder="e.g. All documents are valid." placeholderTextColor="#a4a1bc" textAlignVertical="top" style={{ height: 96, borderRadius: 12, borderWidth: 1, borderColor: LINE, padding: 12, fontSize: 13, color: INK }} />
            </>
          ) : null}
          <ErrorText>{actionError}</ErrorText>
        </View>
      </KeyboardScreen>
      <View style={{ padding: 18, paddingTop: 6 }}>
        {decision === 'clear'
          ? <PrimaryButton title={busy ? 'Please wait...' : 'Confirm Clearance'} onPress={busy ? undefined : confirm} />
          : <Pressable accessibilityRole="button" onPress={() => app.go('reject', { id: params.id })} style={{ height: 56, borderRadius: 16, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Continue to Reject</Text></Pressable>}
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
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginVertical: 10 }}>Reason <Text style={{ color: '#ef4444' }}>*</Text></Text>
          {REASONS.map((item) => (
            <Pressable key={item} onPress={() => setReason(item)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: reason === item ? PURPLE : '#c9c5dc', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>{reason === item ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: PURPLE }} /> : null}</View>
              <Text style={{ fontSize: 13, color: INK }}>{item}</Text>
            </Pressable>
          ))}
          <Text style={{ fontSize: 14, fontWeight: '700', color: INK, marginTop: 14, marginBottom: 8 }}>Additional message <Text style={{ color: '#ef4444' }}>*</Text></Text>
          <TextInput value={message} onChangeText={setMessage} multiline placeholder="Explain what the student should fix." placeholderTextColor="#a4a1bc" textAlignVertical="top" style={{ height: 104, borderRadius: 12, borderWidth: 1, borderColor: LINE, padding: 12, fontSize: 13, color: INK }} />
          {pending.length > 1 ? (
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: INK, marginBottom: 6 }}>Documents to reject</Text>
              {pending.map((doc) => (
                <Pressable key={doc.requirementId} onPress={() => toggle(doc.requirementId)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                  <Ionicons name={chosen.includes(doc.requirementId) ? 'checkbox' : 'square-outline'} size={20} color={PURPLE} style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 13, color: INK }}>{doc.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ marginTop: 10 }}><ErrorText>{rejectError}</ErrorText></View>
        </View>
      </KeyboardScreen>
      <View style={{ padding: 18, paddingTop: 6 }}>
        <Pressable accessibilityRole="button" onPress={busy ? undefined : submit} style={{ height: 56, borderRadius: 16, backgroundColor: '#ef4444', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: 'white' }}>{busy ? 'Please wait...' : 'Reject & Request Re-upload'}</Text>
          <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 10 }} />
        </Pressable>
      </View>
    </View>
  );
}
