import { useState } from 'react';
import { Text } from 'react-native';
import { saveStampedFilesToFolder } from '../components/downloadFile';
import { MUTED, SolidButton } from './ui';

// One tap downloads every file as a single zip into the phone's download folder (asked for once, then remembered).
export default function FolderExport({ files, defaultName, token, title = 'Download Zip' }) {
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const save = async () => {
    setMessage(''); setFailed(false);
    try {
      const savedName = await saveStampedFilesToFolder(files, defaultName, token);
      if (savedName) setMessage(`${files.length} ${files.length === 1 ? 'file' : 'files'} saved as ${savedName}.`);
    } catch (error) { setFailed(true); setMessage(error.message || 'Could not save the files.'); }
  };
  return <>
    <SolidButton icon="download-outline" title={title} onPress={save} />
    {message ? <Text style={{ color: failed ? '#dc2626' : MUTED, fontSize: 13, textAlign: 'center', marginTop: 7 }}>{message}</Text> : null}
  </>;
}
