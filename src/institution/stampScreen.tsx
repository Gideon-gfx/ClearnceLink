import { useLanguage } from '../i18n/LanguageContext';
import StampUploader from '../components/StampUploader';
import { Page } from './ui';

export default function StampScreen({ token, onBack }) {
  const { t } = useLanguage();
  return (
    <Page title={t("Digital Stamp")} onBack={onBack}>
      <StampUploader
        basePath="/api/institution"
        token={token}
        title={t("Institution stamp")}
        description={t("Upload your institution's official stamp or seal. It is added to every student document that gets cleared, in a stamped PDF copy, next to the reviewing officer's own stamp or signature. PNG with a transparent background looks best.")}
      />
    </Page>
  );
}
