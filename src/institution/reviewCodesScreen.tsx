import { useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { useConfirm } from '../components/ConfirmSheet';
import { C, Card, Empty, Heading, Message, Page, Pill, Primary, Secondary } from './ui';

export default function ReviewCodesScreen({ api, kind, onBack, onOpen, autoDeliveryQueued = 0 }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(autoDeliveryQueued ? `${autoDeliveryQueued} Clearance ID emails are being sent automatically.` : '');
  const [busy, setBusy] = useState(false);
  const student = kind === 'students';
  const { confirm, sheet } = useConfirm();
  const load =() => api.request(`/${kind}`).then((result) => setItems(result.items)).catch((cause) => setError(cause.message));
  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, []);
  const allSelected = items.length > 0 && selected.length === items.length;
  const someSelected = selected.length > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? [] : items.map((item) => item.id));
  const toggle = (id) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const approve = async (all) => { setBusy(true); setError(''); try { const result = await api.request(`/${kind}/approve`, all ? { all: true } : { ids: selected }); setNotice(`${result.approved} IDs approved for release.`); setSelected([]); await load(); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  // Codes are only sent to approved people. If some of the people being sent to are not approved yet, ask whether to
  // approve them as part of sending, instead of quietly sending nothing.
  const sendCodes = async (approveFirst, ids) => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (approveFirst) await api.request(`/${kind}/approve`, { ids });
      const result = await api.request(`/${kind}/send`, { ids });
      const delivered = result.results.filter((item) => item.status === 'delivered').length;
      const failed = result.results.length - delivered;
      setNotice(`${delivered} ${delivered === 1 ? 'code' : 'codes'} delivered.${failed ? ` ${failed} could not be delivered; tap Send Approved Codes to retry.` : ''}${result.remaining ? ` ${result.remaining} remain; tap Send Approved Codes again.` : ''}`);
      setSelected([]); await load();
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const send = () => {
    const targets = (selected.length ? items.filter((item) => selected.includes(item.id)) : items).filter((item) => !['delivered', 'queued', 'sending'].includes(item.deliveryStatus));
    const unapproved = targets.filter((item) => !item.approved);
    if (!targets.length) { setError(''); setNotice('These IDs are already delivered or are being sent automatically.'); return; }
    if (!unapproved.length) { sendCodes(false, targets.map((item) => item.id)); return; }
    const approvedCount = targets.length - unapproved.length;
    const everyone = unapproved.length === targets.length;
    confirm({
      icon: 'shield-checkmark-outline',
      title: everyone ? 'Approve before sending?' : 'Some aren’t approved yet',
      message: everyone
        ? `${unapproved.length === 1 ? 'This person hasn’t' : `${unapproved.length} people haven’t`} been approved yet, and codes are only sent to approved people. Approve ${unapproved.length === 1 ? 'them' : 'everyone'} and send ${unapproved.length === 1 ? 'the code' : `all ${unapproved.length} codes`} now?`
        : `${unapproved.length} of ${targets.length} haven’t been approved, so they can’t receive a code yet. Approve everyone and send all ${targets.length} codes, or send only to the ${approvedCount} already approved.`,
      actions: [
        { label: targets.length === 1 ? 'Approve & Send' : `Approve & Send ${targets.length}`, variant: 'primary', onPress: () => sendCodes(true, targets.map((item) => item.id)) },
        ...(approvedCount ? [{ label: `Send ${approvedCount} approved only`, variant: 'outline', onPress: () => sendCodes(false, targets.filter((item) => item.approved).map((item) => item.id)) }] : []),
      ],
    });
  };
  const download = async () => { try { const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`; const lines = [['Full Name', 'Department', student ? 'Clearance ID' : 'Staff Access ID', 'Email', 'Approved', 'Delivery Status'], ...items.map((item) => [item.name, item.department, student ? item.clearanceId : item.accessId, item.email, item.approved ? 'Yes' : 'No', item.deliveryStatus])].map((row) => row.map(escape).join(',')).join('\r\n'); const file = new File(Paths.cache, `${kind}-access-ids.csv`); file.create({ overwrite: true }); file.write(lines); await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' }); } catch (cause) { setError(cause.message); } };
  return <Page title={student ? 'Generated Clearance IDs' : 'Generated Staff Access IDs'} subtitle="Review people before releasing their individual access codes." onBack={onBack} footer={<><Message text={error} error /><Message text={notice} /><Primary title={busy ? 'Please wait...' : 'Send Approved Codes'} disabled={busy} icon="send-outline" onPress={send} /></>}>
    <Text style={{ color: C.muted, fontSize: 11, marginBottom: 12 }}>Each recipient receives only their own ID. Email delivery requires the platform email service.</Text>
    {items.length ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }} accessibilityLabel={allSelected ? 'Deselect all' : 'Select all'} onPress={toggleAll} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 9, borderWidth: 1, borderColor: allSelected ? C.purple : C.line, borderRadius: 13, backgroundColor: '#F8F5FF' }}>
      <View style={{ width: 32, justifyContent: 'center' }}><Ionicons name={allSelected ? 'checkbox' : someSelected ? 'remove-circle-outline' : 'square-outline'} size={22} color={C.purple} /></View>
      <Text style={{ flex: 1, color: C.ink, fontSize: 13, fontFamily: 'Inter_700Bold' }}>{allSelected ? 'Deselect all' : 'Select all'}</Text>
      <Text style={{ color: C.muted, fontSize: 11 }}>{selected.length} of {items.length} selected</Text>
    </Pressable> : null}
    {!items.length ? <Empty title="No generated IDs yet" detail={student ? 'Add or import students to generate IDs.' : 'Add or import staff to generate access IDs.'} /> : items.map((item) => <Card key={item.id}><View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable onPress={() => toggle(item.id)} style={{ width: 32, justifyContent: 'center' }}><Ionicons name={selected.includes(item.id) ? 'checkbox' : 'square-outline'} size={22} color={C.purple} /></Pressable>
      <Pressable onPress={() => onOpen(item.id)} style={{ flex: 1 }}><Text style={{ color: C.ink, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>{item.name}</Text><Text style={{ marginTop: 3, color: C.muted, fontSize: 10 }}>{item.department}</Text><Text style={{ marginTop: 4, color: C.purple, fontSize: 11, fontFamily: 'Inter_700Bold' }}>{student ? item.clearanceId : item.accessId}</Text>{item.deliveryStatus === 'failed' && item.deliveryError ? <Text style={{ marginTop: 4, color: C.red, fontSize: 10, lineHeight: 14 }}>{item.deliveryError}</Text> : null}</Pressable>
      <Pill tone={item.deliveryStatus === 'delivered' ? 'green' : item.deliveryStatus === 'failed' ? 'red' : item.approved ? 'purple' : 'amber'}>{item.deliveryStatus === 'delivered' ? 'Delivered' : item.deliveryStatus === 'failed' ? 'Failed' : item.deliveryStatus === 'queued' ? 'Queued' : item.deliveryStatus === 'sending' ? 'Sending' : item.approved ? 'Ready' : 'Needs Review'}</Pill>
    </View></Card>)}
    {items.length ? <View style={{ gap: 7, marginTop: 10 }}><Secondary title={`Approve Selected (${selected.length})`} icon="checkmark-outline" onPress={() => approve(false)} /><Secondary title="Approve All" icon="checkmark-done-outline" onPress={() => approve(true)} /><Secondary title="Download List" icon="download-outline" onPress={download} /></View> : null}
    {sheet}
  </Page>;
}
