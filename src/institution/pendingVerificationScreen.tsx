import { useLanguage } from '../i18n/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StatusBar, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextLink from '../components/TextLink';
import { INK, MUTED, PURPLE } from '../student/ui';
import PaymentPanel from './paymentPanel';

// Shown when a signed-in institution has no active plan: it registered but hasn't chosen one yet, or its trial /
// subscription has ended. Data is never removed; choosing a plan brings the workspace back.
export default function PendingVerificationScreen({ session, onPaid, onSignOut }) {
  const { t } = useLanguage();
  const expired = Boolean(session.user?.expired);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={{ alignSelf: 'flex-start', marginTop: 14, marginLeft: 14, paddingVertical: 8, paddingHorizontal: 8 }}><TextLink accessibilityLabel="Back to login" onPress={onSignOut} color={PURPLE} left={<Ionicons name="chevron-back" size={22} color={PURPLE} />} style={{ marginLeft: 2, fontSize: 15 }}>{t("Back to Login")}</TextLink></View>
      <PaymentPanel
        token={session.token} signedIn renewing={expired} onDone={(user) => onPaid(user)}
        header={<>
          <Text style={{ fontSize: 24, fontWeight: '800', color: INK, textAlign: 'center', marginTop: 10 }}>{expired ? t("Subscription Expired") : t("Complete your registration")}</Text>
          <Text style={{ fontSize: 13, lineHeight: 20, color: MUTED, textAlign: 'center', marginTop: 8, marginBottom: 22 }}>
            {expired
              ? `${session.user?.institutionName ? `${session.user.institutionName}’s` : 'Your institution’s'} data is safe. Renew your subscription to continue managing clearance activities.`
              : `${session.user?.institutionName ? `${session.user.institutionName} is registered, but it isn’t active yet. ` : ''}Choose a plan to start using ClearanceLink.`}
          </Text>
        </>}
      />
    </SafeAreaView>
  );
}
