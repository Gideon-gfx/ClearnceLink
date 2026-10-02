import { useLanguage } from '../i18n/LanguageContext';
import { StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/Shared';

export default function AccountHomeScreen({ user, onSignOut }) {
  const { t } = useLanguage();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>
        <Text style={{ fontSize: 27, fontWeight: '700', color: '#171548' }}>Welcome, {user?.name || t("User")}</Text>
        <Text style={{ marginTop: 10, fontSize: 15, color: '#68689c' }}>{user?.institutionName || user?.role}</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: '#68689c' }}>Account status: {user?.status || t("active")}</Text>
        <View style={{ marginTop: 32 }}><PrimaryButton title={t("Sign Out")} onPress={onSignOut} /></View>
      </View>
    </SafeAreaView>
  );
}
