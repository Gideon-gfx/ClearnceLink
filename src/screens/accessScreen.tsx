import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StatusBar, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../components/Shared';

export function AccessScreen({ mode, onBack }) {
  const isStudent = mode === 'student';
  const [accessId, setAccessId] = useState('');
  const { width } = useWindowDimensions();
  const backOffset = useRef(new Animated.Value(0)).current;
  const goBack = () => Animated.timing(backOffset, { toValue: width, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onBack(); });
  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: backOffset }] }}>
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white', paddingHorizontal: 24 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} className="mt-1 h-10 w-9 justify-center">
        <Text className="text-[34px] font-light leading-[38px] text-ink">‹</Text>
      </Pressable>
      <View className="items-center px-1 pt-[46px]">
        <Text className="text-center text-[22px] font-bold text-ink">{isStudent ? 'Student Access' : 'Staff Access'}</Text>
        <Text className="mb-6 mt-2 max-w-[280px] text-center text-[13px] leading-[19px] text-muted">
          {isStudent ? 'Enter your Clearance ID to get started.' : 'Enter your Staff Access ID provided by your institution.'}
        </Text>
        <View className="h-[53px] w-full flex-row items-center rounded-xl border border-line px-3">
          <Text className="mr-3 text-[22px] text-brand">⌕</Text>
          <TextInput
            accessibilityLabel={isStudent ? 'Clearance ID' : 'Staff Access ID'}
            value={accessId}
            onChangeText={setAccessId}
            placeholder={isStudent ? 'UNIX-26-K7M4Q9' : 'UNIX-STF-P7N3X1'}
            placeholderTextColor="#241a60"
            autoCapitalize="characters"
            className="h-full flex-1 p-0 text-[15px] text-ink"
          />
        </View>
        <View className="mt-6 w-full">
          <PrimaryButton title="Continue" onPress={() => {}} />
        </View>
        <Text className="mt-[30px] text-center text-xs text-ink">{isStudent ? 'Don’t have a Clearance ID?' : 'Need help?'}</Text>
        <Text className="mt-1 text-center text-xs text-muted">
          {isStudent ? 'Contact your institution.' : 'Contact your institution administrator.'}
        </Text>
      </View>
    </SafeAreaView>
    </Animated.View>
  );
}

