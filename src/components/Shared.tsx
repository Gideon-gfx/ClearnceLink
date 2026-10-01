import { useEffect, useRef, useState } from 'react';
import { useAsyncPress } from './useAsyncPress';
import { notifyFieldFocus } from './KeyboardScreen';
import countryList from 'country-list';
import { countriesForCode } from '../data/dialCodes';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Animated, FlatList, Easing, Keyboard, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';

export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, icon, secureTextEntry, login = false, error = false, adornment }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  // Android hides a typed password character almost immediately. Masking is done here instead, so the latest character
  // stays visible for a couple of seconds (enough to check what you typed) before it turns into a dot.
  const masked = Boolean(secureTextEntry) && !passwordVisible;
  const [revealAt, setRevealAt] = useState(-1);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);
  const current = String(value ?? '');
  const display = masked ? current.split('').map((character, index) => (index === revealAt ? character : '•')).join('') : current;
  const handleChange = (text: string) => {
    if (!masked) { onChangeText(text); return; }
    // Work out what changed by comparing what was on screen with what is on screen now.
    let start = 0;
    while (start < display.length && start < text.length && display[start] === text[start]) start += 1;
    let endOld = display.length;
    let endNew = text.length;
    while (endOld > start && endNew > start && display[endOld - 1] === text[endNew - 1]) { endOld -= 1; endNew -= 1; }
    const inserted = text.slice(start, endNew);
    onChangeText(current.slice(0, start) + inserted + current.slice(endOld));
    if (revealTimer.current) clearTimeout(revealTimer.current);
    if (inserted.length === 1) {
      setRevealAt(start);
      revealTimer.current = setTimeout(() => setRevealAt(-1), 2000);
    } else setRevealAt(-1);
  };
  return (
    <View className="mb-3">
      <Text className="mb-1.5 font-bold text-ink" style={{ fontSize: login ? 16 : 15 }}>{label}</Text>
      <View className={`flex-row items-center rounded-[10px] bg-white px-3 ${multiline ? 'items-start py-3' : ''}`} style={{ height: multiline ? 104 : login ? 58 : 58, borderWidth: 2, borderColor: error ? '#ef4444' : login ? '#c9c1eb' : '#d2caf1' }}>
        {adornment || (icon ? <Ionicons name={icon} size={login ? 21 : 20} color="#8b87a6" style={{ marginRight: 8 }} /> : null)}
        <TextInput
          accessibilityLabel={label}
          value={display}
          onChangeText={handleChange}
          onFocus={notifyFieldFocus}
          placeholder={placeholder}
          placeholderTextColor="#a4a1bc"
          multiline={multiline}
          secureTextEntry={false}
          autoCorrect={masked ? false : undefined}
          spellCheck={masked ? false : undefined}
          keyboardType={masked ? 'visible-password' : keyboardType || 'default'}
          importantForAutofill={masked ? 'no' : 'auto'}
          autoCapitalize={keyboardType === 'email-address' || secureTextEntry ? 'none' : 'sentences'}
          autoComplete={secureTextEntry ? 'off' : keyboardType === 'email-address' ? 'email' : 'off'}
          textAlignVertical={multiline ? 'top' : 'center'}
          className="h-full flex-1 p-0 text-ink"
          style={{ fontSize: login ? 17 : 16 }}
        />
        {secureTextEntry ? (
          <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'} onPress={() => setPasswordVisible((current) => !current)} style={{ marginLeft: 8, padding: 4 }}>
            <Ionicons name={passwordVisible ? 'eye-outline' : 'eye-off-outline'} size={19} color="#7771a3" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export const PASSWORD_RULES = [
  ['At least 8 characters long', (value) => value.length >= 8],
  ['At least one uppercase letter (A to Z)', (value) => /[A-Z]/.test(value)],
  ['At least one number (0 to 9)', (value) => /\d/.test(value)],
  ['At least one special character (for example ! @ # $ %)', (value) => /[^A-Za-z0-9]/.test(value)],
];
export const passwordIsStrong = (value) => PASSWORD_RULES.every(([, test]) => test(value));

// Live checklist: each requirement turns into a green tick once it is met.
// The checklist of password rules. Pass `confirm` (the confirmation field's text) to add a last line that turns green
// once the two passwords match, at which point every line is ticked.
export function PasswordChecklist({ password, confirm }: { password: string; confirm?: string }) {
  const rows: [string, boolean][] = PASSWORD_RULES.map(([label, test]) => [label as string, (test as (value: string) => boolean)(password)]);
  if (confirm !== undefined) rows.push(['Both passwords match', confirm.length > 0 && confirm === password]);
  return (
    <View style={{ marginTop: 2, marginBottom: 8, gap: 10 }}>
      {rows.map(([label, ok]) => (
        <View key={label} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={ok ? '#16a34a' : '#c4c1d8'} style={{ marginRight: 10, marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: ok ? '#171548' : '#6e6b91' }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// Phone input with a separate calling-code box: type "234" and the flag appears, then the number after the divider.
// The combined value is reported as "+234 7083941641".
export function PhoneField({ label, value, onChangeText, error = false, codePlaceholder = '1', numberPlaceholder = '555 123 4567' }) {
  const initial = /^\+(\d{1,4})\s?(.*)$/.exec(value || '');
  const [code, setCode] = useState(initial ? initial[1] : '');
  const [number, setNumber] = useState(initial ? initial[2] : '');
  const [pickedIso, setPickedIso] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Codes such as +1 belong to several countries (US, Canada, Jamaica...): the user picks which one.
  const countries = countriesForCode(code);
  const selected = countries.find((item) => item.iso === pickedIso) || countries[0];
  const shared = countries.length > 1;
  const optionLabel = (item) => `${item.flag}  ${countryList.getName(item.iso) || item.iso}`;
  const update = (nextCode, nextNumber) => {
    setCode(nextCode);
    setNumber(nextNumber);
    onChangeText(nextCode || nextNumber ? `+${nextCode}${nextNumber ? ` ${nextNumber}` : ''}` : '');
  };
  return (
    <View className="mb-3">
      <Text className="mb-1.5 font-bold text-ink" style={{ fontSize: 15 }}>{label}</Text>
      <View className="flex-row items-center rounded-[10px] bg-white px-3" style={{ height: 58, borderWidth: 2, borderColor: error ? '#ef4444' : '#d2caf1' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={shared ? 'Choose country for this calling code' : 'Country flag'}
          disabled={!shared}
          onPress={() => setPickerOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}
        >
          {selected ? <Text style={{ fontSize: 22 }}>{selected.flag}</Text> : <Ionicons name="call-outline" size={20} color="#8b87a6" />}
          {shared ? <Ionicons name="chevron-down" size={16} color="#77738f" style={{ marginLeft: 2 }} /> : null}
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#171548' }}>+</Text>
        <TextInput
          accessibilityLabel={`${label} country code`}
          value={code}
          onChangeText={(text) => update(text.replace(/\D/g, '').slice(0, 4), number)}
          onFocus={notifyFieldFocus}
          placeholder={codePlaceholder}
          placeholderTextColor="#a4a1bc"
          keyboardType="number-pad"
          maxLength={4}
          className="p-0 text-ink"
          style={{ width: 46, fontSize: 16, marginLeft: 2 }}
        />
        <View style={{ width: 2, height: 30, borderRadius: 1, backgroundColor: '#d2caf1', marginHorizontal: 10 }} />
        <TextInput
          accessibilityLabel={label}
          value={number}
          onChangeText={(text) => update(code, text.replace(/[^\d\s]/g, ''))}
          onFocus={notifyFieldFocus}
          placeholder={numberPlaceholder}
          placeholderTextColor="#a4a1bc"
          keyboardType="phone-pad"
          className="h-full flex-1 p-0 text-ink"
          style={{ fontSize: 16 }}
        />
      </View>
      {shared ? (
        <SelectField
          hideTrigger
          label={`Country for +${code}`}
          value={selected ? optionLabel(selected) : ''}
          options={countries.map(optionLabel)}
          onSelect={(option) => setPickedIso(countries.find((item) => optionLabel(item) === option)?.iso || null)}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          searchable={countries.length > 8}
        />
      ) : null}
    </View>
  );
}

export function SelectField({ label, value, placeholder, options, onSelect, icon, searchable = false, hideTrigger = false, open: controlledOpen, onOpenChange, error = false, emptyText = 'No matching countries' }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : innerOpen;
  const setOpen = (next) => { setInnerOpen(next); onOpenChange?.(next); };
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { height: windowHeight } = useWindowDimensions();
  const windowHeightRef = useRef(windowHeight);
  windowHeightRef.current = windowHeight;
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const listOffset = useRef(0);
  const closeRef = useRef(() => {});

  const available = Math.max(windowHeight - keyboardHeight, windowHeight * 0.4);
  const sheetHeight = searchable ? available * 0.8 : Math.min(available * 0.8, 92 + options.length * 54 + 24);
  const backdropOpacity = translateY.interpolate({ inputRange: [0, sheetHeight], outputRange: [0.5, 0], extrapolate: 'clamp' });
  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter((option) => option.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()))
    : options;

  const openSheet = () => {
    translateY.setValue(windowHeightRef.current);
    listOffset.current = 0;
    setSearchQuery('');
    setKeyboardHeight(0);
    setOpen(true);
  };
  const closeSheet = () => {
    Animated.timing(translateY, { toValue: windowHeightRef.current, duration: 210, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => setOpen(false));
  };
  closeRef.current = closeSheet;
  const snapBack = () => Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 240, mass: 0.85, useNativeDriver: true }).start();

  useEffect(() => {
    if (open) Animated.spring(translateY, { toValue: 0, damping: 24, stiffness: 210, mass: 0.9, useNativeDriver: true }).start();
  }, [open, translateY]);

  useEffect(() => {
    if (!open || !searchable) return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, [open, searchable]);

  // Drag from the top of the sheet (handle + title) straight away, or from the list once it is scrolled to the top.
  const dragHandlers = {
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 90 || gesture.vy > 0.9) closeRef.current();
      else snapBack();
    },
    onPanResponderTerminate: snapBack,
  };
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.dy > 14 && gesture.dy > Math.abs(gesture.dx) && listOffset.current <= 0,
    ...dragHandlers,
  })).current;
  const headerPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    ...dragHandlers,
  })).current;

  const sheet = (
      <Modal transparent visible={open} animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={closeSheet}>
        <View style={{ flex: 1, paddingBottom: keyboardHeight }}>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: '#17132b', opacity: backdropOpacity }]} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Close ${label} options`} onPress={closeSheet} style={{ flex: 1 }} />
          <Animated.View {...panResponder.panHandlers} style={{ height: sheetHeight, transform: [{ translateY }], borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 28 }}>
            <View style={{ flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' }}>
            <View {...headerPan.panHandlers} style={{ paddingBottom: 6 }}>
              <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 14 }}><View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: '#cfcbe0' }} /></View>
              <Text className="mb-2.5 px-5 font-bold text-ink" style={{ fontSize: 19 }}>{label}</Text>
            </View>
            {searchable ? (
              <View className="mx-5 mb-3 h-12 flex-row items-center rounded-[10px] bg-[#fbfaff] px-3" style={{ borderWidth: 2, borderColor: '#d2caf1' }}>
                <Ionicons name="search-outline" size={19} color="#8b87a6" style={{ marginRight: 8 }} />
                <TextInput
                  accessibilityLabel={`Search ${label.toLowerCase()}`}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={`Search ${label.toLowerCase()}`}
                  placeholderTextColor="#a4a1bc"
                  autoCapitalize="none"
                  returnKeyType="search"
                  className="h-full flex-1 p-0 text-ink"
                  style={{ fontSize: 16 }}
                />
              </View>
            ) : null}
            <FlatList
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
              data={filteredOptions}
              keyExtractor={(option) => option}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={14}
              maxToRenderPerBatch={16}
              windowSize={7}
              removeClippedSubviews
              getItemLayout={(_, index) => ({ length: 54, offset: 54 * index, index })}
              onScroll={(event) => { listOffset.current = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={64}
              ListEmptyComponent={searchable ? <Text className="py-5 text-center text-sm text-muted">{emptyText}</Text> : null}
              renderItem={({ item: option }) => (
                <Pressable onPress={() => { onSelect(option); closeSheet(); }} className="flex-row items-center border-b border-[#f0eff7]" style={{ minHeight: 54 }}>
                  <Text className={option === value ? 'font-bold text-brand' : 'text-ink'} style={{ flex: 1, fontSize: 17 }}>{option}</Text>
                  {option === value ? <Ionicons name="checkmark" size={21} color="#5a17c9" /> : null}
                </Pressable>
              )}
            />
            </View>
          </Animated.View>
        </View>
      </Modal>
  );

  // Controlled use without a field (e.g. the calling-code country picker) renders just the sheet.
  if (hideTrigger) return sheet;
  return (
    <View className="mb-3">
      <Text className="mb-1.5 font-bold text-ink" style={{ fontSize: 15 }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={openSheet}
        className="flex-row items-center justify-between rounded-[10px] bg-white px-3"
        style={{ height: 58, borderWidth: 2, borderColor: error ? '#ef4444' : open ? '#5a17c9' : '#d2caf1', backgroundColor: error ? '#fffafa' : 'white' }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
          {icon ? <Ionicons name={icon} size={20} color="#8b87a6" style={{ marginRight: 8 }} /> : null}
          <Text style={{ flex: 1, fontSize: 16, color: value ? '#171548' : '#a4a1bc' }}>{value || placeholder}</Text>
        </View>
        <Ionicons name="chevron-down" size={20} color="#77738f" />
      </Pressable>
      {sheet}
    </View>
  );
}

export function PrimaryButton({ title, onPress, height, width, radius, loading: loadingProp = false }) {
  const [pending, press] = useAsyncPress(onPress);
  const loading = loadingProp || pending;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={loading ? undefined : press}
      className="relative h-14 flex-row items-center justify-center rounded-2xl bg-brand active:opacity-85"
      style={height || width || radius ? { height, width: width || '100%', alignSelf: 'center', borderRadius: radius } : undefined}
    >
      <Text className="text-lg font-bold text-white">{title}</Text>
      <View className="absolute bottom-0 right-4 top-0 justify-center">
        {loading ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="chevron-forward" size={24} color="#ffffff" />}
      </View>
    </Pressable>
  );
}

export function ScreenTransition({ children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 210, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [opacity, translateY]);

  return <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}


export function UploadCard({ title, hint, onPress, selectedName }) {
  return (
    <View className="mb-3">
      <Text className="mb-1.5 font-bold text-ink" style={{ fontSize: 15 }}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${selectedName || hint}`}
        onPress={onPress}
        className="flex-row items-center rounded-[10px] bg-white px-3"
        style={{ height: 58, borderWidth: 2, borderColor: selectedName ? '#5a17c9' : '#d2caf1' }}
      >
        <Ionicons name={selectedName ? 'document-text' : 'document-text-outline'} size={20} color={selectedName ? '#5a17c9' : '#8b87a6'} style={{ marginRight: 8 }} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, color: selectedName ? '#171548' : '#a4a1bc' }}>{selectedName || hint}</Text>
        <Ionicons name={selectedName ? 'checkmark-circle' : 'cloud-upload-outline'} size={22} color={selectedName ? '#16a34a' : '#5a17c9'} style={{ marginLeft: 8 }} />
      </Pressable>
    </View>
  );
}

