import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { C, Card, Heading, Input, Message, Page, Pill, Primary, Secondary } from './ui';
import StudentCompletion from './studentCompletion';

function Row({ label, value }) { return <View style={{ minHeight: 41, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: C.line }}><Text style={{ flex: 1, color: C.muted, fontSize: 11 }}>{label}</Text><Text style={{ flex: 1.25, textAlign: 'right', color: C.ink, fontSize: 11, fontFamily: 'Inter_500Medium' }}>{value || '—'}</Text></View>; }

export default function PersonDetailScreen({ api, kind, id, onBack, onAssignRole }) {
  const student = kind === 'students';
  const [item, setItem] = useState(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [matricNo, setMatricNo] = useState('');
  const [tuitionStatus, setTuitionStatus] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  const load = () => api.request(`/${kind}/${id}`).then((result) => { setItem(result.item); setEmail(result.item.email || ''); setPhone(result.item.phone || ''); setMatricNo(result.item.matricNo || ''); setTuitionStatus(result.item.tuitionStatus || ''); }).catch((cause) => setError(cause.message));
  useEffect(() => { load(); }, [id]);
  const update = async (changes, message) => { setError(''); try { const result = await api.request(`/${kind}/${id}`, changes, 'PATCH'); setItem(result.item); setNotice(message); } catch (cause) { setError(cause.message); } };
  const sendId = async () => {
    setError(''); setNotice(''); setSending(true);
    try {
      // Save whatever is typed in the contact fields first, so the ID goes to the address on screen.
      if (email !== (item.email || '') || phone !== (item.phone || '')) await api.request(`/${kind}/${id}`, { email, phone }, 'PATCH');
      const result = await api.request(`/${kind}/${id}/resend`, {}, 'POST');
      setItem(result.item); setNotice(`Clearance ID sent to ${result.sentTo}. Ask them to check Spam if it isn’t in the inbox.`);
    } catch (cause) { setError(cause.message); } finally { setSending(false); }
  };
  const removeRole =() => Alert.alert('Remove officer authority?', 'The staff member will lose clearance officer access. Historical actions remain.', [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { try { await api.request(`/staff/${id}/role`, {}, 'DELETE'); setNotice('Officer authority removed.'); load(); } catch (cause) { setError(cause.message); } } }]);
  return <Page title={student ? 'Student Details' : 'Staff Details'} onBack={onBack}>
    <View style={{ alignItems: 'center', marginBottom: 20 }}><View style={{ width: 65, height: 65, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: C.pale }}><Text style={{ color: C.purple, fontSize: 25, fontFamily: 'Inter_700Bold' }}>{item?.name?.[0] || '?'}</Text></View><Text style={{ marginTop: 9, color: C.ink, fontSize: 16, fontFamily: 'Inter_700Bold' }}>{item?.name || 'Loading...'}</Text><Text style={{ marginTop: 4, color: C.muted, fontSize: 11 }}>{student ? item?.clearanceId : item?.accessId}</Text><View style={{ marginTop: 7 }}><Pill tone={item?.disabled ? 'red' : item?.approved ? 'green' : 'amber'}>{item?.disabled ? 'Disabled' : item?.approved ? 'Approved' : 'Pending Review'}</Pill></View></View>
    <Message text={error} error /><Message text={notice} />
    {item ? <>
      <Card><Row label={student ? 'JAMB Registration' : 'Institution Staff ID'} value={student ? item.jamb : item.staffId} /><Row label="Faculty" value={item.faculty} /><Row label="Department" value={item.department} />{student ? <><Row label="Programme" value={item.programme} /><Row label="Level" value={`${item.level} Level`} /><Row label="Admission Year" value={item.admissionYear} /></> : <Row label="Job Title" value={item.jobTitle} />}<Row label="Delivery" value={item.deliveryStatus} /><Row label="Email" value={item.email} /><Row label="Phone" value={item.phone} /></Card>
      <Heading>Update Contact</Heading><Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" /><Input label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /><Secondary title="Save Contact" icon="save-outline" onPress={() => update({ email, phone }, 'Contact saved. Tap “Email Clearance ID” to send it to this address.')} /><View style={{ marginTop: 7 }}><Secondary title={sending ? 'Sending...' : item.deliveryStatus === 'delivered' ? 'Resend Clearance ID by Email' : 'Email Clearance ID'} icon="mail-outline" onPress={sending ? undefined : sendId} /></View>
      {student ? <><Heading>Student Records</Heading><Input label="Matriculation Number" value={matricNo} onChangeText={setMatricNo} placeholder="Add when issued" /><Input label="Tuition Status" value={tuitionStatus} onChangeText={setTuitionStatus} placeholder="Verified / Pending" /><Secondary title="Save Student Records" icon="save-outline" onPress={() => update({ matricNo, tuitionStatus }, 'Student records updated.')} /><StudentCompletion api={api} id={id} item={item} onChanged={setItem} /></> : <><Heading>Clearance Authority</Heading><Card>{item.role === 'officer' && item.scope ? <><Row label="Role" value="Clearance Officer" /><Row label="Faculty" value={item.scope.faculty} /><Row label="Department" value={item.scope.department} /><Row label="Level" value={item.scope.level} /><Row label="Session" value={item.scope.session} /></> : <Text style={{ color: C.muted, fontSize: 12 }}>No clearance officer role assigned.</Text>}</Card><Secondary title={item.role ? 'Change Officer Scope' : 'Assign Officer Role'} icon="shield-outline" onPress={() => onAssignRole(item.id)} />{item.role ? <View style={{ marginTop: 7 }}><Secondary title="Remove Officer Authority" icon="close-circle-outline" onPress={removeRole} /></View> : null}</>}
      <View style={{ marginTop: 18 }}><Primary title={item.disabled ? 'Reactivate Account' : 'Disable Account'} danger={!item.disabled} icon={item.disabled ? 'checkmark-outline' : 'ban-outline'} onPress={() => Alert.alert(item.disabled ? 'Reactivate account?' : 'Disable account?', 'The person’s history will be kept.', [{ text: 'Cancel' }, { text: 'Continue', onPress: () => update({ disabled: !item.disabled }, item.disabled ? 'Account reactivated.' : 'Account disabled.') }])} /></View>
    </> : null}
  </Page>;
}
