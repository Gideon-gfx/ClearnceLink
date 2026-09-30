import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { SelectField } from '../components/Shared';
import { C, Card, Input, Message, Page, Primary } from './ui';

// Academic sessions to pick from: last year through four years ahead, e.g. 2026/2027.
const thisYear = new Date().getFullYear();
const SESSIONS = Array.from({ length: 6 }, (_, index) => `${thisYear - 1 + index}/${thisYear + index}`);
const labelOf = (item) => `${item.name} (${item.accessId})`;

export default function AssignRoleScreen({ api, staffId, onBack, onSaved }) {
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(staffId || '');
  const [faculty, setFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('100');
  const [session, setSession] = useState('2026/2027');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.request('/staff').then((result) => { setStaff(result.items.filter((item) => !item.disabled)); const person = result.items.find((item) => item.id === staffId); if (person) { setFaculty(person.scope?.faculty || person.faculty || ''); setDepartment(person.scope?.department || person.department || ''); setLevel(person.scope?.level || '100'); setSession(person.scope?.session || '2026/2027'); } }).catch((cause) => setError(cause.message)); }, [staffId]);
  const person = staff.find((item) => item.id === selected);
  const [showErrors, setShowErrors] = useState(false);
  const invalid = { staff: !selected, department: !department.trim(), level: !/^\d{3}$/.test(String(level).trim()), session: !session };
  const assign = async () => { if (Object.values(invalid).some(Boolean)) { setShowErrors(true); setError('Please fill in all the highlighted fields.'); return; } setBusy(true); setError(''); try { await api.request(`/staff/${selected}/role`, { faculty, department, level, session }); onSaved(selected); } catch (cause) { setError(cause.message); } finally { setBusy(false); } };
  return <Page title="Assign Clearance Role" subtitle="Set the staff member’s authority and scope. Only the assigned officer can create clearances within this scope." onBack={onBack} footer={<><Message text={error} error /><Primary title={busy ? 'Assigning...' : 'Assign Role'} disabled={busy} onPress={assign} /></>}>
    <SelectField
      error={showErrors && invalid.staff} label="Staff Member" value={person ? labelOf(person) : ''} placeholder="Choose staff member" icon="person-outline" searchable emptyText="No matching staff"
      options={staff.map(labelOf)}
      onSelect={(label) => { const item = staff.find((entry) => labelOf(entry) === label); if (!item) return; setSelected(item.id); setFaculty(item.scope?.faculty || item.faculty || ''); setDepartment(item.scope?.department || item.department || ''); }}
    />
    <Input label="Role" value="Clearance Officer" onChangeText={() => {}} />
    <Input label="Faculty" value={faculty} onChangeText={setFaculty} placeholder="Faculty of Computing" />
    <Input error={showErrors && invalid.department} label="Department" value={department} onChangeText={setDepartment} placeholder="Computer Science" />
    <Input error={showErrors && invalid.level} label="Level" value={level} onChangeText={setLevel} placeholder="100" keyboardType="number-pad" />
    <SelectField error={showErrors && invalid.session} label="Session" value={session} placeholder="Select session" icon="calendar-outline" options={SESSIONS.includes(session) || !session ? SESSIONS : [session, ...SESSIONS]} onSelect={setSession} />
    <Card style={{ marginTop: 9, backgroundColor: '#F7F3FF' }}><Text style={{ color: C.ink, fontSize: 11, lineHeight: 17 }}>This officer will only manage clearances for {department || 'the selected department'}, {level || 'selected'} Level, {session || 'the selected session'}.</Text></Card>
  </Page>;
}
