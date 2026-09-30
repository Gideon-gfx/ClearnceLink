import { useState } from 'react';
import { View } from 'react-native';
import { Input, Message, Page, Primary } from './ui';

export default function PersonForm({ api, kind, onBack, onSaved }) {
  const student = kind === 'students';
  const [form, setForm] = useState({ name: '', jamb: '', staffId: '', email: '', phone: '', faculty: '', department: '', programme: '', entryLevel: '100', level: '100', admissionYear: String(new Date().getFullYear()), admissionStatus: 'Accepted', jobTitle: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }));
  // Required fields (the same ones the server checks). Empty or invalid ones turn red once Save is tapped.
  const [showErrors, setShowErrors] = useState(false);
  const invalid = {
    name: !form.name.trim(),
    id: student ? !form.jamb.trim() : !form.staffId.trim(),
    email: !/^\S+@\S+\.\S+$/.test(form.email.trim()),
    department: !form.department.trim(),
    programme: student && !form.programme.trim(),
    level: student && !/^\d{3}$/.test(form.level.trim()),
    year: student && !/^\d{4}$/.test(form.admissionYear.trim()),
  };
  const red = (key) => showErrors && Boolean(invalid[key]);
  const save = async () => {
    if (Object.values(invalid).some(Boolean)) { setShowErrors(true); setError('Please fill in all the highlighted fields.'); return; }
    setBusy(true); setError('');
    try { const result = await api.request(`/${kind}`, form); onSaved(result.item); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <Page title={student ? 'Add Student' : 'Add Staff'} subtitle={student ? 'Enter the admitted student’s details. A Clearance ID will be generated for your review.' : 'Add a staff member. Access ID delivery requires your approval.'} onBack={onBack} footer={<><Message text={error} error /><Primary title={busy ? 'Saving...' : student ? 'Add Student' : 'Add Staff'} icon="arrow-forward" disabled={busy} onPress={save} /></>}>
    <Input label="Full Name" value={form.name} onChangeText={set('name')} placeholder="e.g. Gideon Gbolahan Solomon" error={red('name')} />
    <Input label={student ? 'JAMB Registration Number' : 'Institution Staff ID'} value={student ? form.jamb : form.staffId} onChangeText={set(student ? 'jamb' : 'staffId')} placeholder={student ? '2026XXXXXXXX' : 'STF-001'} error={red('id') || /jamb|staff id/i.test(error)} />
    <Input label="Email" value={form.email} onChangeText={set('email')} placeholder="name@institution.edu" keyboardType="email-address" error={red('email')} />
    <Input label="Phone Number" value={form.phone} onChangeText={set('phone')} placeholder="+234 708 394 1641" keyboardType="phone-pad" />
    <Input label="Faculty / School" value={form.faculty} onChangeText={set('faculty')} placeholder="Faculty of Computing" />
    <Input label="Department" value={form.department} onChangeText={set('department')} placeholder="Computer Science" error={red('department')} />
    {student ? <>
      <Input label="Programme" value={form.programme} onChangeText={set('programme')} placeholder="B.Sc Computer Science" error={red('programme')} />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Input label="Entry Level" value={form.entryLevel} onChangeText={set('entryLevel')} placeholder="100" keyboardType="number-pad" /></View><View style={{ flex: 1 }}><Input label="Current Level" value={form.level} onChangeText={set('level')} placeholder="100" keyboardType="number-pad" error={red('level')} /></View></View>
      <Input label="Admission Year" value={form.admissionYear} onChangeText={set('admissionYear')} placeholder="2026" keyboardType="number-pad" error={red('year')} />
      <Input label="Admission Status" value={form.admissionStatus} onChangeText={set('admissionStatus')} placeholder="Accepted" />
    </> : <Input label="Job Title" value={form.jobTitle} onChangeText={set('jobTitle')} placeholder="Lecturer / Administrator" />}
  </Page>;
}
