const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Use Reanimated's compiled entry instead of a potentially incomplete source
// folder in Windows installs synced through OneDrive.
config.resolver.resolverMainFields = config.resolver.resolverMainFields.filter(
  (field) => field !== 'react-native'
);

// The website build (Vite) writes into ./dist. It is not part of the app, and OneDrive placeholder files in there
// crash Metro while it indexes the project, so the bundler ignores these two folders at the project root only
// (never the dist folders inside node_modules).
const path = require('path');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const ignored = ['dist', 'student UI'].map((folder) => new RegExp(`^${escapeRegExp(path.join(__dirname, folder))}[\\\\/].*`));
const existing = config.resolver.blockList;
config.resolver.blockList = [...(Array.isArray(existing) ? existing : existing ? [existing] : []), ...ignored];

module.exports = withNativeWind(config, { input: './global.css' });
