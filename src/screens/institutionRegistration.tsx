import BackArrow from '../components/BackArrow';
import { useEffect, useRef, useState } from 'react';
import KeyboardScreen from '../components/KeyboardScreen';
import ErrorBanner from '../components/ErrorBanner';
import * as ImagePicker from 'expo-image-picker';
import { readFileAsBase64 } from '../components/readFile';
import countryList from 'country-list';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Animated, BackHandler, Easing, Image, Platform, Pressable, StatusBar, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Field, PasswordChecklist, PhoneField, PrimaryButton, ScreenTransition, SelectField, passwordIsStrong } from '../components/Shared';
import PaymentPanel from '../institution/paymentPanel';
import { apiRequest } from '../api';

const institutionTypes = ['University', 'Polytechnic', 'College of Education', 'Other'];
const countries = countryList.getNames().sort((first, second) => first.localeCompare(second));
const stateOptions = {
  Nigeria: ['Abuja (FCT)', 'Lagos', 'Ogun', 'Oyo', 'Rivers', 'Other'],
  Ghana: ['Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Other'],
  Kenya: ['Nairobi', 'Mombasa', 'Kisumu', 'Kiambu', 'Other'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Other'],
  Other: ['Other'],
};

export default function InstitutionRegistrationScreen({ onExit, onPaid }) {
  const [openingLink, setOpeningLink] = useState(false);
  const openLink = (url) => { setOpeningLink(true); Linking.openURL(url).catch(() => {}).finally(() => setTimeout(() => setOpeningLink(false), 600)); };
  const { width } = useWindowDimensions();
  const backOffset = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(1);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [institutionName, setInstitutionName] = useState('');
  const [institutionLogo, setInstitutionLogo] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [account, setAccount] = useState(null); // set once the account exists; the plan/payment step acts for it
  const [institutionType, setInstitutionType] = useState('');
  const [otherInstitutionType, setOtherInstitutionType] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [otherState, setOtherState] = useState('');
  const [city, setCity] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [officialPhone, setOfficialPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [adminName, setAdminName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [password, setPassword] = useState('');

  // Slide 3 cannot be submitted until every field is filled in; unfilled or invalid ones get a red border.
  const [showErrors, setShowErrors] = useState(false);
  const adminInvalid = {
    name: !adminName.trim(),
    job: !jobTitle.trim(),
    email: !/^\S+@\S+\.\S+$/.test(adminEmail.trim()),
    phone: !/^\+\d{1,4}\s/.test(adminPhone) || adminPhone.replace(/^\+\d+\s?/, '').replace(/\D/g, '').length < 6,
    password: !passwordIsStrong(password),
  };
  const adminHasErrors = Object.values(adminInvalid).some(Boolean);
  const FILL_MESSAGE = 'Please fill in all the highlighted fields.';

  // Slide 1: every required field must be filled; unfilled ones get a red border when Continue is tapped.
  const [showErrors1, setShowErrors1] = useState(false);
  const basicInvalid = {
    logo: !logoFile,
    name: !institutionName.trim(),
    type: !institutionType || (institutionType === 'Other' && !otherInstitutionType.trim()),
    country: !country,
    address1: !addressLine1.trim(),
    state: !state || (state === 'Other' && !otherState.trim()),
    city: !city.trim(),
    postal: !postalCode.trim(),
  };
  const basicHasErrors = Object.values(basicInvalid).some(Boolean);
  useEffect(() => {
    if (showErrors1 && !basicHasErrors) setRegistrationError((current) => (current === FILL_MESSAGE ? '' : current));
  }, [showErrors1, basicHasErrors]);
  useEffect(() => {
    if (showErrors && !adminHasErrors) setRegistrationError((current) => (current === FILL_MESSAGE ? '' : current));
  }, [showErrors, adminHasErrors]);

  // After "Create Account" a 6-digit code is emailed to the administrator; the account is created once it is confirmed.
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const codeInput = useRef(null);
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const keepErrorOnStepChange = useRef(false);
  const sendCode = async () => {
    setRegistrationError('');
    setRegistrationBusy(true);
    try {
      const result = await apiRequest('/api/auth/institutions/otp', { email: adminEmail.trim(), name: adminName });
      setMaskedEmail(result.maskedContact);
      setCode('');
      setResendIn(300);
      setVerifying(true);
    } catch (cause) { setRegistrationError(cause.message); }
    finally { setRegistrationBusy(false); }
  };
  // Shows a short spinner on Continue before the next slide appears.
  const nextSlide = () => {
    setRegistrationBusy(true);
    setTimeout(() => { setRegistrationBusy(false); setStep((current) => current + 1); }, 300);
  };
  const startVerification = () => {
    if (adminHasErrors) { setShowErrors(true); setRegistrationError(FILL_MESSAGE); return; }
    if (!logoFile) { keepErrorOnStepChange.current = true; setShowErrors1(true); setRegistrationError('Upload your institution logo.'); setStep(1); return; }
    sendCode();
  };
  const submitRegistration = async () => {
    if (code.length !== 6) { setRegistrationError('Enter the 6-digit code.'); return; }
    setRegistrationError('');
    setRegistrationBusy(true);
    try {
      const created = await apiRequest('/api/auth/institutions/register', {
        institutionName, institutionType: institutionType === 'Other' ? otherInstitutionType : institutionType,
        country, state: state === 'Other' ? otherState : state, city, postalCode, addressLine1, addressLine2, address: [addressLine1, addressLine2].map((line) => line.trim()).filter(Boolean).join(', '), officialEmail,
        officialPhone, website, adminName, jobTitle, email: adminEmail, phone: adminPhone, password, logo: logoFile, code,
      });
      setAccount(created);
      setVerifying(false);
      setStep(4);
    } catch (cause) { setRegistrationError(cause.message); }
    finally { setRegistrationBusy(false); }
  };

  const pickInstitutionLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) { setRegistrationError('Logo must be under 2MB.'); return; }
      const base64 = await readFileAsBase64(asset.uri);
      setInstitutionLogo(asset.uri);
      setLogoFile({ name: asset.fileName || 'institution-logo.png', mimeType: asset.mimeType || 'image/png', base64 });
    }
  };

  const goBack = () => {
    if (verifying) { setVerifying(false); setRegistrationError(''); return; }
    if (step === 4) onExit(); // the account already exists, so leaving this step goes to login (the plan can be chosen there)
    else if (step > 1) setStep((current) => current - 1);
    else onExit();
  };
  const goBackAnimated = () => Animated.timing(backOffset, { toValue: width, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
    if (finished) { backOffset.setValue(0); goBack(); }
  });

  // A message such as "Upload your institution logo." belongs to one slide only, so it never follows you to the next.
  useEffect(() => {
    if (keepErrorOnStepChange.current) keepErrorOnStepChange.current = false;
    else setRegistrationError('');
  }, [step]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => subscription.remove();
  }, [step, verifying]);

  const progressWidth = ['w-1/4', 'w-2/4', 'w-3/4', 'w-full'][step - 1];
  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: backOffset }] }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }} edges={Platform.OS === 'android' ? ['left', 'right', 'bottom'] : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View className="flex-1">
        <View className="flex-row items-center gap-3 px-[22px] pb-3 pt-16">
          <BackArrow onPress={goBackAnimated} label={step === 1 ? 'Back to previous screen' : 'Previous registration step'} size={36} color="#171548" className="h-12 w-12 items-center justify-center" />
          <View className="h-[10px] flex-1 overflow-hidden rounded-full bg-[#eceafa]">
            <View className={`h-full rounded-full bg-brand ${progressWidth}`} />
          </View>
          <Text className="w-11 text-right text-lg font-bold text-muted">{step}/4</Text>
        </View>
        {step === 4 ? (
          <ScreenTransition key="institution-register-plan">
            <PaymentPanel
              token={account?.token} onDone={(user) => onPaid(user)}
              header={<>
                <Text className="text-center text-[26px] font-extrabold leading-8 tracking-tight text-ink">Choose Your Plan</Text>
                <Text style={{ fontSize: 15, lineHeight: 22, marginBottom: 24 }} className="mt-1 text-center text-muted">Start a free trial or subscribe to activate your institution.</Text>
              </>}
            />
          </ScreenTransition>
        ) : (
        <ScreenTransition key={`institution-register-${step}-${verifying ? 1 : 0}`}>
        <KeyboardScreen contentContainerClassName="grow px-6 pb-[42px] pt-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {step === 1 ? (
            <>
              <Text className="text-center text-[26px] font-extrabold leading-8 tracking-tight text-ink">Create Institution Account</Text>
              <Text style={{ marginBottom: 64 }} className="mt-1 text-center text-sm font-semibold leading-5 text-muted">Provide your institution’s basic information.</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={institutionLogo ? 'Change institution logo' : 'Upload institution logo'} onPress={pickInstitutionLogo} className="mb-[18px] h-[156px] items-center justify-center rounded-[13px] border border-[#cfcafa] bg-[#fbfaff]" style={showErrors1 && basicInvalid.logo ? { borderColor: '#ef4444', borderWidth: 2, backgroundColor: '#fffafa' } : undefined}>
                {institutionLogo ? (
                  <Image source={{ uri: institutionLogo }} resizeMode="contain" className="mb-1.5 h-[58px] w-[58px] rounded-[10px]" />
                ) : (
                  <View className="mb-1.5 h-[42px] w-[42px] items-center justify-center rounded-full bg-[#eeeaff]"><Ionicons name="camera-outline" size={23} color="#5a17c9" /></View>
                )}
                <Text className="text-base font-semibold text-muted">{institutionLogo ? 'Change Institution Logo' : 'Upload Institution Logo'}</Text>
                <Text className="mt-1 text-xs text-[#9390aa]">PNG, JPG · Max 2MB</Text>
              </Pressable>
              <Field error={showErrors1 && basicInvalid.name} label="Institution Name" value={institutionName} onChangeText={setInstitutionName} placeholder="e.g. University of Excellence" />
              <SelectField
                error={showErrors1 && !institutionType}
                label="Institution Type"
                value={institutionType}
                placeholder="Select institution type"
                options={institutionTypes}
                onSelect={(value) => {
                  setInstitutionType(value);
                  if (value !== 'Other') setOtherInstitutionType('');
                }}
                icon="school-outline"
              />
              {institutionType === 'Other' ? (
                <Field error={showErrors1 && !otherInstitutionType.trim()} label="Specify Institution Type" value={otherInstitutionType} onChangeText={setOtherInstitutionType} placeholder="Enter institution type" icon="create-outline" />
              ) : null}
              <SelectField error={showErrors1 && basicInvalid.country} label="Country" value={country} placeholder="Select country" options={countries} onSelect={(value) => { setCountry(value); setState(''); setOtherState(''); }} icon="globe-outline" searchable />
              {country ? (
                <>
                  <Field error={showErrors1 && basicInvalid.address1} label="Address Line 1" value={addressLine1} onChangeText={setAddressLine1} placeholder="Street address, P.O. box" icon="location-outline" />
                  <Field label="Address Line 2 (Optional)" value={addressLine2} onChangeText={setAddressLine2} placeholder="Apartment, suite, building" icon="business-outline" />
                  {stateOptions[country] ? (
                    <SelectField error={showErrors1 && !state} label="State / Region" value={state} placeholder="Select state or region" options={stateOptions[country]} onSelect={(value) => { setState(value); setOtherState(''); }} icon="map-outline" />
                  ) : (
                    <Field error={showErrors1 && !state.trim()} label="State / Region" value={state} onChangeText={setState} placeholder="Enter state or region" icon="map-outline" />
                  )}
                  {state === 'Other' ? <Field error={showErrors1 && !otherState.trim()} label="Specify State / Region" value={otherState} onChangeText={setOtherState} placeholder="Enter state or region" icon="create-outline" /> : null}
                  <Field error={showErrors1 && basicInvalid.city} label="City" value={city} onChangeText={setCity} placeholder="Enter city" icon="business-outline" />
                  <Field error={showErrors1 && basicInvalid.postal} label="Postal Code" value={postalCode} onChangeText={setPostalCode} placeholder="Enter postal code" keyboardType="number-pad" icon="mail-open-outline" />
                </>
              ) : null}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <Text className="text-center text-[26px] font-extrabold leading-8 tracking-tight text-ink">Institution Details</Text>
              <Text style={{ marginBottom: 48 }} className="mt-1 text-center text-xs leading-[18px] text-muted">Provide your institution’s contact information.</Text>
              <Field label="Official Email" value={officialEmail} onChangeText={setOfficialEmail} placeholder="institution@email.edu" keyboardType="email-address" icon="mail-outline" />
              <PhoneField label="Official Phone Number" value={officialPhone} onChangeText={setOfficialPhone} />
              <Field label="Institution Website (Optional)" value={website} onChangeText={setWebsite} placeholder="https://your-website.edu" keyboardType="url" icon="globe-outline" />
            </>
          ) : null}
          {step === 3 && verifying ? (
            <>
              <Text className="text-center text-[26px] font-extrabold leading-8 tracking-tight text-ink">Verify Your Email</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, marginBottom: 32 }} className="mt-1 text-center text-muted">{'Enter the 6-digit code we sent to\n' + maskedEmail}</Text>
              <Pressable onPress={() => codeInput.current?.focus()} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {Array.from({ length: 6 }, (_, index) => {
                  const focused = index === Math.min(code.length, 5);
                  return (
                    <View key={index} style={{ width: 48, height: 58, borderRadius: 12, borderWidth: focused ? 2 : 1.5, borderColor: registrationError ? '#ef4444' : focused ? '#5a17c9' : '#d2caf1', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
                      <Text style={{ fontSize: 22, fontWeight: '700', color: '#171548' }}>{code[index] || ''}</Text>
                    </View>
                  );
                })}
                <TextInput ref={codeInput} accessibilityLabel="6-digit code" value={code} onChangeText={(text) => { setRegistrationError(''); setCode(text.replace(/\D/g, '').slice(0, 6)); }} keyboardType="number-pad" autoFocus maxLength={6} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }} />
              </Pressable>
              <Text style={{ marginTop: 18, textAlign: 'center', fontSize: 13, color: '#6e6b91' }}>
                {resendIn > 0 ? 'Code expires in ' + String(Math.floor(resendIn / 60)).padStart(2, '0') + ':' + String(resendIn % 60).padStart(2, '0') : 'This code has expired. Request a new one.'}
              </Text>
              <Pressable disabled={resendIn > 0 || registrationBusy} onPress={sendCode} style={{ marginTop: 6, alignSelf: 'center', padding: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: resendIn > 0 ? '#b9a5e8' : '#5a17c9' }}>Resend code</Text>
              </Pressable>
            </>
          ) : null}
          {step === 3 && !verifying ? (
            <>
              <Text className="text-center text-[26px] font-extrabold leading-8 tracking-tight text-ink">Primary Administrator Details</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, marginBottom: 28 }} className="mt-1 text-center text-muted">Create the main administrator account for your institution.</Text>
              <Field label="Full Name" value={adminName} onChangeText={setAdminName} placeholder="e.g. Dr. Adebayo Johnson" icon="person-outline" error={showErrors && adminInvalid.name} />
              <Field label="Job Title" value={jobTitle} onChangeText={setJobTitle} placeholder="e.g. Institution Administrator" icon="briefcase-outline" error={showErrors && adminInvalid.job} />
              <Field label="Work Email" value={adminEmail} onChangeText={setAdminEmail} placeholder="admin@yourinstitution.edu" keyboardType="email-address" icon="mail-outline" error={showErrors && adminInvalid.email} />
              <PhoneField label="Phone Number" value={adminPhone} onChangeText={setAdminPhone} error={showErrors && adminInvalid.phone} />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Create a strong password" secureTextEntry icon="lock-closed-outline" error={showErrors && adminInvalid.password} />
              {password ? <PasswordChecklist password={password} /> : null}
            </>
          ) : null}
          {step < 4 ? (
            <View className="mt-auto pt-3">
              <ErrorBanner message={registrationError} />
              <PrimaryButton
                title={step === 3 ? (verifying ? (registrationBusy ? 'Verifying...' : 'Verify & Continue') : (registrationBusy ? 'Sending code...' : 'Create Account')) : 'Continue'}
                loading={registrationBusy}
                onPress={() => (step === 1 && basicHasErrors ? (setShowErrors1(true), setRegistrationError(FILL_MESSAGE)) : step < 3 ? nextSlide() : registrationBusy ? undefined : verifying ? submitRegistration() : startVerification())}
              />
              {step === 3 && !verifying ? (
                <Text className="mt-3 text-center text-[10px] leading-4 text-muted">
                  By continuing, you agree to our{'\n'}
                  <Text className="font-bold text-ink" onPress={() => openLink('https://clearancelink.app/terms-of-use')}>Terms of Service</Text> and <Text className="font-bold text-ink" onPress={() => openLink('https://clearancelink.app/privacy-policy')}>Privacy Policy.</Text>{openingLink ? <ActivityIndicator size="small" color="#5a17c9" style={{ marginLeft: 6 }} /> : null}
                </Text>
              ) : null}
            </View>
          ) : null}
        </KeyboardScreen>
        </ScreenTransition>
        )}
      </View>
    </SafeAreaView>
    </Animated.View>
  );
}
