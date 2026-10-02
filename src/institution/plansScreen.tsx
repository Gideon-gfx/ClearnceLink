import { useLanguage } from '../i18n/LanguageContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, ScreenTitle } from './ui';
import PaymentPanel from './paymentPanel';

// Each plan has its own colour: Starter blue, Standard gold, Pro emerald, Enterprise a rich purple with sparkle.
export const PLAN_THEMES = {
  trial: { color: '#0E8A8A', tint: '#E6F6F6', icon: 'rocket-outline' },
  starter: { color: '#2563EB', tint: '#EAF1FF', icon: 'leaf-outline' },
  standard: { color: '#B7791F', tint: '#FFF6DC', icon: 'star-outline' },
  pro: { color: '#0F9D6B', tint: '#E4F8EF', icon: 'diamond-outline' },
  enterprise: { color: '#7A2BD9', tint: '#F1E6FF', icon: 'sparkles', gradient: ['#4B12A8', '#8A35EE', '#C25BFF'] },
};
export const planTheme = (plan) => PLAN_THEMES[plan] || { color: C.purple, tint: '#F8F5FF', icon: 'ribbon-outline' };

// "Free Trial · 5 days left", "Standard · 23 days left", "Standard · expired"
export function planSummary(user) {
  const name = user?.plan === 'trial' ? 'Free Trial' : user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : 'No plan';
  if (!user?.plan) return name;
  if (user.expired) return `${name} · expired`;
  const days = user.expiresAt ? Math.max(0, Math.ceil((Date.parse(user.expiresAt) - Date.now()) / 86400000)) : null;
  return days === null ? name : `${name} · ${days} ${days === 1 ? 'day' : 'days'} left`;
}

// The institution's plans, opened from the More screen: see what is active and upgrade or renew.
export default function PlansScreen({ user, token, onChanged, onBack }) {
  const { t } = useLanguage();
  const theme = planTheme(user?.plan);
  const enterprise = user?.plan === 'enterprise';
  const inner = <>
    <Ionicons name={theme.icon} size={26} color={enterprise ? 'white' : theme.color} />
    <View style={{ flex: 1, marginLeft: 12 }}>
      <Text style={{ fontSize: 12, color: enterprise ? 'rgba(255,255,255,0.8)' : C.muted }}>{t("Current plan")}</Text>
      <Text style={{ marginTop: 2, fontSize: 18, color: enterprise ? 'white' : theme.color, fontFamily: 'Inter_800ExtraBold', fontWeight: '800' }}>{planSummary(user)}</Text>
    </View>
    {enterprise ? <Ionicons name="sparkles" size={20} color="#FFE9A8" /> : null}
  </>;
  const card = { flexDirection: 'row', alignItems: 'center', padding: 14, marginTop: 6, marginBottom: 16, borderRadius: 14 } as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScreenTitle title={t("Plans")} onBack={onBack} />
      <PaymentPanel
        token={token} signedIn renewing={Boolean(user?.expired)} onDone={(updated) => { onChanged(updated); onBack(); }}
        header={<>
          {enterprise
            ? <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={card}>{inner}</LinearGradient>
            : <View style={{ ...card, backgroundColor: theme.tint, borderWidth: 2, borderColor: theme.color }}>{inner}</View>}
          <Text style={{ fontSize: 13, lineHeight: 20, color: C.muted, marginBottom: 16 }}>{t("Choose a plan to upgrade or renew. Your data and records stay exactly as they are.")}</Text>
        </>}
      />
    </SafeAreaView>
  );
}
