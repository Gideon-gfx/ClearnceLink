import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, View } from 'react-native';
import { apiBaseUrl } from '../api';
import { useLogoUri } from '../institution/ui';

// The institution's logo in a round frame (staff and student headers). `path` is the API route that serves it.
export default function InstitutionLogo({ path, hasLogo, token, size = 56 }: { path: string; hasLogo?: boolean; token: string; size?: number }) {
  const uri = useLogoUri(hasLogo ? `${apiBaseUrl}${path}` : null, token);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: uri ? 'white' : '#5A17C9', borderWidth: uri ? 1 : 0, borderColor: '#E5E1F5', overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityLabel="Institution logo" /> : <Ionicons name="school" size={size * 0.52} color="white" />}
    </View>
  );
}
