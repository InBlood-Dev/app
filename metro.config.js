const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Fix Firebase JS SDK "Component auth has not been registered yet" error
//
// Expo SDK 54 enables unstable_enablePackageExports by default but sets
// unstable_conditionNames to []. With empty conditions, @firebase/auth's
// exports field resolves to 'default' (browser entry) instead of 'react-native'.
// Only the react-native entry (dist/rn/index.js) calls registerAuth(),
// which registers the auth component with the Firebase app container.
// Without this, initializeAuth() and getAuth() both throw
// "Component auth has not been registered yet".
config.resolver.unstable_conditionNames = [
  'react-native',
  'require',
];

module.exports = config;
