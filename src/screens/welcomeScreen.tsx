import { useLanguage } from '../i18n/LanguageContext';
import { useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Animated, Easing, Image, Platform, Pressable, StatusBar, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function ModeIcon({ mode, light = false }) {
  const name = mode === 'student' ? 'person' : mode === 'staff' ? 'people' : 'business';
  return <Ionicons name={name} size={mode === 'student' ? 16 : 21} color={light ? '#ffffff' : '#5b10d7'} />;
}

const buttonGradient = [
  '#8525ee', '#8022e9', '#7b1fe3', '#761cdc', '#711ad6', '#6b17cf', '#6515c9', '#5f13c2',
  '#5911bb', '#530fb5', '#4d0dae', '#470ba8', '#4209a2', '#3d079d',
];
const welcomeText = 'Welcome';
const welcomeSubtitle = 'Digitize and simplify your clearance process.';
const welcomeVideos = [
  require('../assets/firstIntro-mobile.mp4'),
  require('../assets/secondIntro-mobile.mp4'),
  require('../assets/firstVideo-mobile.mp4'),
  require('../assets/secondVideo-mobile.mp4'),
];
let welcomeIntroPlayed = false;

function DocumentPopup({ visible, width, height }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.25)), useNativeDriver: true }),
      Animated.delay(1550),
      Animated.timing(progress, { toValue: 2, duration: 500, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.delay(350),
    ]));
    animation.start();
    return () => { animation.stop(); progress.setValue(0); };
  }, [visible, progress]);

  if (!visible) return null;
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 1, 1.7, 2], outputRange: [0, 0.9, 0.9, 0.9, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [75, 0, -35] });
  const scale = progress.interpolate({ inputRange: [0, 1, 2], outputRange: [0.65, 1, 0.92] });
  const cardWidth = Math.min(width * 0.42, 178);

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: height * 0.49, right: width * 0.075, width: cardWidth, height: cardWidth * 1.26, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', backgroundColor: 'rgba(255,255,255,0.78)', padding: 16, opacity, transform: [{ translateY }, { scale }, { rotate: '-8deg' }], zIndex: 2, shadowColor: '#1d0640', shadowOpacity: 0.3, shadowRadius: 14, elevation: 7 }}>
      <Ionicons name="document-text" size={31} color="#6720c5" />
      <View style={{ height: 5, width: '78%', borderRadius: 3, backgroundColor: '#9b6ade', marginTop: 15 }} />
      <View style={{ height: 5, width: '94%', borderRadius: 3, backgroundColor: '#d3bdf1', marginTop: 9 }} />
      <View style={{ height: 5, width: '83%', borderRadius: 3, backgroundColor: '#d3bdf1', marginTop: 9 }} />
      <View style={{ height: 5, width: '62%', borderRadius: 3, backgroundColor: '#d3bdf1', marginTop: 9 }} />
      <View style={{ position: 'absolute', right: 12, bottom: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6d22cd' }}>
        <Ionicons name="checkmark" size={23} color="white" />
      </View>
    </Animated.View>
  );
}

function ModeButton({ mode, title, active, onPress, scale, fontsLoaded }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`relative flex-row items-center overflow-hidden border bg-white active:opacity-85 ${active ? 'border-[#5a13c4]' : 'border-[#e9e6f8]'}`}
      style={{ height: 43 * scale, borderRadius: 11 * scale, paddingHorizontal: 12 * scale, elevation: active ? 3 : 1 }}
    >
      {active ? (
        <View pointerEvents="none" className="absolute inset-0 flex-row">
          {buttonGradient.map((color, index) => <View key={index} style={{ flex: 1, backgroundColor: color }} />)}
        </View>
      ) : null}
      <View style={{ width: 27 * scale, alignItems: 'center', transform: [{ scale }] }}>
        <ModeIcon mode={mode} light={active} />
      </View>
      <Text style={{ marginLeft: 11 * scale, fontSize: 11.5 * scale, fontFamily: fontsLoaded ? 'Inter_600SemiBold' : undefined, fontWeight: fontsLoaded ? undefined : '600', color: active ? 'white' : '#171548', flex: 1 }}>{title}</Text>
      <Ionicons name="arrow-forward" size={16 * scale} color={active ? 'white' : '#7773a4'} />
    </Pressable>
  );
}

export default function WelcomeScreen({ onSelectMode }) {
  const { t } = useLanguage();
  const animateIntro = useRef(!welcomeIntroPlayed).current;
  const [welcomeChars, setWelcomeChars] = useState(animateIntro ? 0 : welcomeText.length);
  const [subtitleChars, setSubtitleChars] = useState(animateIntro ? 0 : welcomeSubtitle.length);
  const buttonOpacity = useRef(['student', 'staff', 'institution'].map(() => new Animated.Value(animateIntro ? 0 : 1))).current;
  const buttonOffset = useRef(['student', 'staff', 'institution'].map(() => new Animated.Value(animateIntro ? 24 : 0))).current;
  const currentVideo = useRef(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const videoPlayer = useVideoPlayer(welcomeVideos[0], (player) => {
    player.loop = false;
    player.muted = true;
    player.play();
  });
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const { width, height } = useWindowDimensions();
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenOffset = useRef(new Animated.Value(0)).current;
  const buttonScales = useRef({
    student: new Animated.Value(1),
    staff: new Animated.Value(1),
    institution: new Animated.Value(1),
  }).current;
  const transitioning = useRef(false);
  const scale = Math.min(Math.max(width / 260, 1), 1.62);
  const logoSize = Math.min(width * 0.64, height * 0.28, 255);
  useEffect(() => {
    let switching = false;
    let mounted = true;
    let playbackErrors = 0;
    let startTimer;
    const advanceVideo = async () => {
      if (switching || !mounted) return;
      switching = true;
      const nextVideo = (currentVideo.current + 1) % welcomeVideos.length;
      try {
        clearTimeout(startTimer);
        await videoPlayer.replaceAsync(welcomeVideos[nextVideo]);
        if (mounted) {
          currentVideo.current = nextVideo;
          setActiveVideoIndex(nextVideo);
          videoPlayer.currentTime = 0;
          videoPlayer.play();
          // Some Android players finish preparing after replaceAsync resolves.
          startTimer = setTimeout(() => {
            if (mounted && !videoPlayer.playing) videoPlayer.play();
          }, 300);
        }
      } catch (error) {
        console.warn('Unable to play the next welcome video:', error);
      } finally {
        switching = false;
      }
    };
    const endSubscription = videoPlayer.addListener('playToEnd', advanceVideo);
    const statusSubscription = videoPlayer.addListener('statusChange', ({ status, error }) => {
      if (status === 'readyToPlay') {
        playbackErrors = 0;
        if (mounted && !videoPlayer.playing) videoPlayer.play();
      }
      if (status === 'error') {
        console.warn('Welcome video playback failed:', error);
        playbackErrors += 1;
        if (playbackErrors < welcomeVideos.length) advanceVideo();
      }
    });
    return () => { mounted = false; clearTimeout(startTimer); endSubscription.remove(); statusSubscription.remove(); };
  }, [videoPlayer]);
  useEffect(() => {
    if (!animateIntro) return;
    welcomeIntroPlayed = true;
    const timers = [];
    for (let index = 1; index <= welcomeText.length; index += 1) timers.push(setTimeout(() => setWelcomeChars(index), 180 + index * 85));
    const subtitleStart = 180 + welcomeText.length * 85 + 180;
    for (let index = 1; index <= welcomeSubtitle.length; index += 1) timers.push(setTimeout(() => setSubtitleChars(index), subtitleStart + index * 28));
    timers.push(setTimeout(() => Animated.stagger(150, buttonOpacity.map((opacity, index) => Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(buttonOffset[index], { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]))).start(), subtitleStart + welcomeSubtitle.length * 28 + 120));
    return () => timers.forEach(clearTimeout);
  }, []);
  const selectMode = (mode) => {
    if (transitioning.current) return;
    transitioning.current = true;
    Animated.sequence([
      Animated.timing(buttonScales[mode], { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(buttonScales[mode], { toValue: 1.04, duration: 140, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(screenOffset, { toValue: -width * 0.22, duration: 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(screenOpacity, { toValue: 0, duration: 320, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => {
      if (finished) onSelectMode(mode);
      else transitioning.current = false;
    });
  };
  return (
    <Animated.View style={{ flex: 1, backgroundColor: '#1c0a38', opacity: screenOpacity, transform: [{ translateX: screenOffset }] }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0E6FF" />
      {/* The video fills the whole screen, so no solid colour ever shows along the bottom. */}
      <VideoView player={videoPlayer} nativeControls={false} contentFit="cover" surfaceType="textureView" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0, backgroundColor: '#1c0a38' }} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 1 }]}>
        {/* Dark, faint purple tint over the whole video (also keeps the white text readable). */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(42,11,89,0.38)' }]} />
        <LinearGradient colors={['rgba(193,143,250,0.30)', 'rgba(136,75,218,0.12)', 'rgba(92,28,184,0)']} locations={[0, 0.55, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '43%' }} />
        {/* Fades smoothly into a deep, dark purple toward the footer (no hard edge). */}
        <LinearGradient colors={['rgba(28,10,56,0)', 'rgba(32,9,68,0.55)', 'rgba(24,6,52,0.88)']} locations={[0, 0.5, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' }} />
      </View>
      <DocumentPopup visible={activeVideoIndex === 3} width={width} height={height} />
      <SafeAreaView style={{ flex: 1, zIndex: 2 }} edges={Platform.OS === 'android' ? ['left', 'right', 'bottom'] : undefined}>
        <View style={{ flex: 1, paddingTop: 30, paddingBottom: 28 }}>
          <Image source={require('../assets/logo-transparent.png')} resizeMode="contain" style={{ width: logoSize, height: logoSize, alignSelf: 'center' }} accessibilityLabel="ClearanceLink logo" />
          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <Text accessibilityLabel={welcomeText} style={{ minHeight: 28 * scale, fontSize: 22 * scale, lineHeight: 28 * scale, fontFamily: fontsLoaded ? 'Inter_800ExtraBold' : undefined, fontWeight: fontsLoaded ? undefined : '900', letterSpacing: -0.3 * scale, color: 'white', textShadowColor: 'rgba(35,7,83,0.55)', textShadowRadius: 8 }}>{welcomeText.slice(0, welcomeChars)}</Text>
            <Text accessibilityLabel={welcomeSubtitle} style={{ minHeight: 34 * scale, marginTop: 3 * scale, marginHorizontal: 18, fontSize: 11.5 * scale, lineHeight: 17 * scale, fontFamily: fontsLoaded ? 'Inter_500Medium' : undefined, fontWeight: fontsLoaded ? undefined : '500', color: 'white', textAlign: 'center', textShadowColor: 'rgba(35,7,83,0.65)', textShadowRadius: 5 }}>{welcomeSubtitle.slice(0, subtitleChars)}</Text>
          </View>
          <View style={{ marginTop: 30 * scale, marginHorizontal: 20 * scale, gap: 11 * scale }}>
            <Animated.View style={{ opacity: buttonOpacity[0], transform: [{ translateY: buttonOffset[0] }, { scale: buttonScales.student }] }}>
              <ModeButton mode="student" title={t("Student")} active scale={scale} fontsLoaded={fontsLoaded} onPress={() => selectMode('student')} />
            </Animated.View>
            <Animated.View style={{ opacity: buttonOpacity[1], transform: [{ translateY: buttonOffset[1] }, { scale: buttonScales.staff }] }}>
              <ModeButton mode="staff" title={t("Staff")} scale={scale} fontsLoaded={fontsLoaded} onPress={() => selectMode('staff')} />
            </Animated.View>
            <Animated.View style={{ opacity: buttonOpacity[2], transform: [{ translateY: buttonOffset[2] }, { scale: buttonScales.institution }] }}>
              <ModeButton mode="institution" title={t("Institution")} scale={scale} fontsLoaded={fontsLoaded} onPress={() => selectMode('institution')} />
            </Animated.View>
          </View>
          <View style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'flex-end' }}>
            <Text style={{ fontSize: 9 * scale, lineHeight: 12 * scale, fontFamily: fontsLoaded ? 'Inter_500Medium' : undefined, fontWeight: fontsLoaded ? undefined : '500', textAlign: 'center', color: 'white' }}>One platform for a smarter{'\n'}academic experience.</Text>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

