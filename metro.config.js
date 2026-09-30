const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Use Reanimated's compiled entry instead of a potentially incomplete source
// folder in Windows installs synced through OneDrive.
config.resolver.resolverMainFields = config.resolver.resolverMainFields.filter(
  (field) => field !== 'react-native'
);

module.exports = withNativeWind(config, { input: './global.css' });
