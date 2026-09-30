import { useEffect, useState } from 'react';
import { useAsyncPress } from '../components/useAsyncPress';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Image, Linking, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { apiRequest } from '../api';
import ErrorBanner from '../components/ErrorBanner';
import { INK, MUTED, PURPLE, SolidButton } from '../student/ui';

const SYMBOLS = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: 'GH₵', KES: 'KSh', ZAR: 'R' };
const money = (amount, currency) => {
  const number = Number(amount);
  const digits = number % 1 === 0 ? 0 : 2;
  const text = number.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${SYMBOLS[currency] || `${currency} `}${text}`;
};
// The line under a price: just the billing period (or a short label). No second amount is shown.
const priceNote = (config, usd, approx, unit) => unit;
const period = (days) => (days === 365 ? 'per year' : days === 30 ? 'per month' : `per ${days} days`);

const INCLUDED = [
  'Import students and staff from a spreadsheet, or add them one by one',
  'Clearance IDs and Staff Access IDs generated and emailed to each person',
  'Assign clearance officers and control the scope they work in',
  'Document review with clear / reject, plus your digital stamp on cleared files',
  'ID card, matric number and certificate after clearance',
  'Full audit history of every action',
];

// The panel that unfolds under a card: a short heading and a checklist.
function Details({ heading, lines = INCLUDED }) {
  return (
    <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: '#f5f2ff' }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: INK, marginBottom: 8 }}>{heading}</Text>
      {lines.map((line) => (
        <View key={line} style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Ionicons name="checkmark-circle" size={16} color="#16a34a" style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 17, color: '#55527a' }}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function Radio({ on }) {
  return <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? PURPLE : '#b7b2d6'} />;
}

// One selectable plan card. Tapping selects it and unfolds its details; the chevron sits at the top-right.
function PlanCard({ on, open, onPress, title, badge, subtitle, price, priceNote, dashed, children }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: on, expanded: open }}
      onPress={onPress}
      style={{ padding: 14, marginBottom: 10, borderRadius: 16, borderWidth: on ? 2 : 1.5, borderStyle: dashed && !on ? 'dashed' : 'solid', borderColor: on ? PURPLE : '#e2ddf5', backgroundColor: on ? '#faf8ff' : 'white' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ marginRight: 12 }}><Radio on={on} /></View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: INK }}>{title}</Text>
            {badge ? <View style={{ marginLeft: 8, backgroundColor: badge.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ fontSize: 9, fontWeight: '800', color: badge.color }}>{badge.text}</Text></View> : null}
          </View>
          <Text style={{ marginTop: 2, fontSize: 12, color: MUTED }}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: INK }}>{price}</Text>
          {priceNote ? <Text style={{ fontSize: 11, color: MUTED }}>{priceNote}</Text> : null}
        </View>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: open ? '#ede9fe' : '#f5f3fb', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={PURPLE} />
        </View>
      </View>
      {open ? children : null}
    </Pressable>
  );
}

function FooterButton({ icon, title, onPress, busy: busyProp, disabled }) {
  const [pending, press] = useAsyncPress(onPress);
  const busy = busyProp || pending;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={busy || disabled ? undefined : press}
      className="active:opacity-85"
      style={{ height: 56, borderRadius: 16, backgroundColor: disabled ? '#c9b8f0' : '#5a17c9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.85 : 1 }}
    >
      {busy ? <ActivityIndicator color="#ffffff" /> : <Ionicons name={icon} size={20} color="#ffffff" style={{ marginRight: 8 }} />}
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#ffffff' }}>{busy ? 'Please wait...' : title}</Text>
    </Pressable>
  );
}

// Plan step: pick the free trial, a plan tiered by student count (paid through Paystack), or Enterprise.
// Fills its parent: the plan cards scroll, and the action button is attached directly beneath them at the bottom.
// `header` is shown above the cards and scrolls with them.
export default function PaymentPanel({ token, onDone, signedIn = false, renewing = false, header = null }) {
  const [config, setConfig] = useState(null);
  const [selected, setSelected] = useState(''); // '' | 'trial' | plan id | 'enterprise'
  const [checkout, setCheckout] = useState(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    apiRequest('/api/institution-payment/config', undefined, token)
      .then((result) => setConfig(result))
      .catch((cause) => setError(cause.message));
  }, [token]);

  const guard = async (task) => {
    setBusy(true); setError('');
    try { await task(); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  };
  const plan = config?.plans?.find((item) => item.id === selected);
  const trialOffered = Boolean(config?.trial?.available) && !renewing;

  const verify = (ref) => guard(async () => {
    const result = await apiRequest('/api/institution-payment/verify', { reference: ref }, token);
    if (result.status === 'success') { setSuccess({ user: result.user, trial: false, planName: plan?.name, amount: plan && config ? money(plan.price, config.currency) : null }); return; }
    setError(result.status === 'failed' || result.status === 'abandoned' ? 'The payment was not completed. You have not been charged. Please try again.' : 'We have not received the payment yet. If you have just paid, wait a moment and check again.');
  });

  const pay = () => guard(async () => {
    const init = await apiRequest('/api/institution-payment/init', { planId: selected }, token);
    setReference(init.reference);
    if (Platform.OS === 'web') { await Linking.openURL(init.authorizationUrl); return; }
    setCheckout(init);
  });

  const startTrial = () => guard(async () => {
    const result = await apiRequest('/api/institution-payment/trial', {}, token);
    setSuccess({ user: result.user, trial: true });
  });

  const contactSales = () => Linking.openURL(`mailto:${config?.enterprise?.email || ''}?subject=ClearanceLink%20Enterprise`);

  const closeCheckout = () => {
    const ref = checkout?.reference;
    setCheckout(null);
    if (ref) verify(ref);
  };

  // The action button follows whatever is selected.
  const starterTrial = trialOffered && selected === (config?.trial?.planId || 'starter');
  let footer = null;
  if (!success && config && !selected) footer = <FooterButton disabled icon="card-outline" title="Choose a plan to continue" />;
  if (!success && selected) {
    if (starterTrial) {
      footer = (
        <View>
          <FooterButton icon="rocket-outline" title={`Start ${config.trial.days}-day free trial`} busy={busy && !checkout} onPress={startTrial} />
          <Pressable accessibilityRole="button" onPress={busy ? undefined : pay} style={{ marginTop: 10, alignItems: 'center', padding: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: PURPLE }}>Skip the trial and pay {money(plan.price, config.currency)} now</Text>
          </Pressable>
        </View>
      );
    } else if (selected === 'enterprise') footer = <FooterButton icon="mail-outline" title="Contact sales" onPress={contactSales} />;
    else if (plan) footer = <FooterButton icon="card-outline" title={`Make payment · ${money(plan.price, config.currency)}`} busy={busy && !checkout} onPress={pay} />;
  }

  if (success) {
    const days = success.trial ? config?.trial?.days : config?.subscriptionDays;
    const until = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
    const rows = [
      ['Institution', success.user?.institutionName],
      ['Plan', success.trial ? `Starter · ${config?.trial?.days}-day free trial` : success.planName],
      [success.trial ? 'Cost today' : 'Amount paid', success.trial ? 'Free' : success.amount],
      [success.trial ? 'Trial ends' : 'Valid until', until],
      ...(success.trial && config?.plans?.[0] ? [['After the trial', `${money(config.plans[0].price, config.currency)} per month, only if you subscribe`]] : []),
    ].filter(([, value]) => value);
    const dots = [['#f59e0b', 24, 34], ['#8b5cf6', 60, 12], ['#22c55e', 110, 20], ['#ec4899', 10, 88], ['#3b82f6', 132, 84], ['#f59e0b', 118, 150], ['#8b5cf6', 6, 148]];
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: 22, paddingTop: 34, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            {dots.map(([color, x, y], index) => <View key={index} style={{ position: 'absolute', left: x, top: y, width: index % 2 ? 8 : 6, height: index % 2 ? 8 : 6, borderRadius: 4, backgroundColor: color, opacity: 0.85 }} />)}
            <View style={{ width: 180, height: 180, borderRadius: 90, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 138, height: 138, borderRadius: 69, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center', shadowColor: '#16a34a', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
                  <Ionicons name="checkmark" size={56} color="#ffffff" />
                </View>
              </View>
            </View>
          </View>
          <Text style={{ fontSize: 26, fontWeight: '800', color: INK, textAlign: 'center' }}>{success.trial ? 'Your free trial has started!' : 'Payment successful!'}</Text>
          <Text style={{ marginTop: 10, fontSize: 14, lineHeight: 21, color: MUTED, textAlign: 'center', maxWidth: 320 }}>
            {success.trial ? `You have Starter free for ${config?.trial?.days} days: up to ${Number(config?.trial?.students).toLocaleString('en-US')} students, unlimited staff, every feature. We will email you a day before it ends. Nothing is charged automatically.` : 'Thank you. Your institution is now active.'} {signedIn ? 'You can start using ClearanceLink now.' : 'Sign in with your work email and password to get started.'}
          </Text>
          {rows.length ? (
            <View style={{ alignSelf: 'stretch', marginTop: 26, borderRadius: 16, borderWidth: 1, borderColor: '#e6e3f7', backgroundColor: '#ffffff', shadowColor: '#3b1a8a', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 }}>
              {rows.map(([label, value], index) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: index ? 1 : 0, borderTopColor: '#f0eef8' }}>
                  <Text style={{ fontSize: 13, color: MUTED }}>{label}</Text>
                  <Text numberOfLines={1} style={{ flexShrink: 1, marginLeft: 16, fontSize: 14, fontWeight: '700', color: label === 'Cost today' || label === 'Amount paid' ? '#15803d' : INK }}>{value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, backgroundColor: 'white' }}>
          <FooterButton icon="arrow-forward" title={signedIn ? 'Continue' : 'Continue to Login'} onPress={() => onDone(success.user)} />
        </View>
      </View>
    );
  }

  const toggle = (id) => setSelected((current) => (current === id ? '' : id));
  const topStudents = (config?.plans?.[config.plans.length - 1]?.students || 10000).toLocaleString('en-US');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 22, paddingTop: 8, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {header}
      {!config && !error ? <ActivityIndicator color={PURPLE} style={{ marginVertical: 30 }} /> : null}

      {config?.plans?.map((item) => {
        const isTrialPlan = trialOffered && item.id === (config.trial.planId || 'starter');
        const perMonth = `${money(item.price, config.currency)} ${period(config.subscriptionDays)}`;
        return (
          <PlanCard
            key={item.id}
            on={selected === item.id} open={selected === item.id} onPress={() => toggle(item.id)}
            title={item.name}
            badge={isTrialPlan ? { text: `${config.trial.days} DAYS FREE`, bg: '#dcfce7', color: '#15803d' } : item.id === 'standard' ? { text: 'POPULAR', bg: '#ede9fe', color: PURPLE } : null}
            subtitle={`Up to ${item.students.toLocaleString('en-US')} active students`}
            price={isTrialPlan ? 'Free' : money(item.price, config.currency)}
            priceNote={isTrialPlan ? `then ${money(item.price, config.currency)} / month` : priceNote(config, item.priceUsd, item.approx, period(config.subscriptionDays))}
          >
            {isTrialPlan ? (
              <>
                <Details heading={`Try Starter free for ${config.trial.days} days. No card needed.`} lines={[`Up to ${item.students.toLocaleString('en-US')} active students and unlimited staff`, ...INCLUDED]} />
                <Details
                  heading="How billing works"
                  lines={[
                    `Your ${config.trial.days}-day trial starts today.`,
                    'We email you one day before it ends.',
                    `To keep going after that, subscribe to Starter for ${perMonth}.`,
                    'Nothing is charged automatically. If you do nothing, your account pauses and your data stays safe.',
                  ]}
                />
              </>
            ) : (
              <Details heading={`Up to ${item.students.toLocaleString('en-US')} active students, unlimited staff. Everything included:`} />
            )}
          </PlanCard>
        );
      })}

      {config ? (
        <PlanCard
          dashed on={selected === 'enterprise'} open={selected === 'enterprise'} onPress={() => toggle('enterprise')}
          title="Enterprise" subtitle={`${topStudents}+ active students`}
          price={config.enterprise?.from ? `From ${money(config.enterprise.from, config.currency)}` : 'Custom'} priceNote={config.enterprise?.from ? priceNote(config, config.enterprise.fromUsd, config.enterprise.approx, 'contact us') : 'contact us'}
        >
          <Details heading="For large institutions and groups. Everything above, plus a plan sized and priced for you:" lines={['Volume beyond the standard plans', 'Onboarding help and priority support', 'Pricing agreed with our team']} />
        </PlanCard>
      ) : null}

      <View style={{ marginTop: 4 }}>
        <ErrorBanner message={error} />
        {reference ? (
          <Pressable accessibilityRole="button" onPress={() => verify(reference)} style={{ marginTop: 12, alignItems: 'center', padding: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: PURPLE }}>I’ve already paid — check payment status</Text>
          </Pressable>
        ) : null}
        <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {/* The official Paystack mark; the artwork has padding, so it is cropped to the mark itself. */}
          <View style={{ width: 20, height: 20, overflow: 'hidden', marginRight: 8 }}>
            <Image source={require('../assets/paystack-mark.png')} accessibilityLabel="Paystack" style={{ width: 40, height: 40, marginLeft: -10, marginTop: -10 }} />
          </View>
          <Text style={{ flexShrink: 1, fontSize: 11, lineHeight: 16, color: MUTED }}>Payments are processed securely by <Text style={{ fontWeight: '800', color: '#0b3a55' }}>Paystack</Text>. We never see your card details.</Text>
        </View>
      </View>

      </ScrollView>

      {/* Always visible at the bottom: greyed out until a plan is chosen. */}
      <View style={{ paddingHorizontal: 22, paddingTop: 10, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#efecfa', backgroundColor: 'white' }}>
        {footer || <FooterButton disabled icon="card-outline" title="Choose a plan to continue" />}
      </View>

      <Modal visible={Boolean(checkout)} animationType="slide" onRequestClose={closeCheckout}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close payment" onPress={closeCheckout} style={{ width: 40, height: 44, justifyContent: 'center' }}><Ionicons name="close" size={26} color={INK} /></Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: INK, marginRight: 40 }}>Secure payment</Text>
          </View>
          {checkout ? (
            <WebView
              source={{ uri: checkout.authorizationUrl }}
              startInLoadingState
              renderLoading={() => <ActivityIndicator color={PURPLE} style={{ position: 'absolute', top: '45%', alignSelf: 'center' }} />}
              // Paystack redirects here when the payment finishes; catch it and confirm with the server.
              onShouldStartLoadWithRequest={(request) => { if (request.url.startsWith(checkout.callbackUrl)) { closeCheckout(); return false; } return true; }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
