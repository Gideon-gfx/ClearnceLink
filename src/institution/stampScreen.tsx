import StampUploader from '../components/StampUploader';
import { Page } from './ui';

export default function StampScreen({ token, onBack }) {
  return (
    <Page title="Digital Stamp" onBack={onBack}>
      <StampUploader
        basePath="/api/institution"
        token={token}
        title="Institution stamp"
        description="Upload your institution's official stamp or seal. It is added to every student document that gets cleared, in a stamped PDF copy, next to the reviewing officer's own stamp or signature. PNG with a transparent background looks best."
      />
    </Page>
  );
}
