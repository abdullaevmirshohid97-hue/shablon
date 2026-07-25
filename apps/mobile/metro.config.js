const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch the whole workspace and resolve modules from both
// the app's own node_modules and the hoisted workspace root.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Hierarchical lookup stays ENABLED: with npm hoisting, some Expo deps
// (expo-asset, expo-font, @expo/vector-icons, ...) are nested under
// node_modules/expo/node_modules rather than hoisted to the root. Disabling
// hierarchical lookup would make Metro unable to resolve them and the app
// would fail to bundle ("Unable to resolve module expo-asset").

// SDK 54's Metro enables package "exports" resolution by default, which makes
// @supabase/supabase-js pull in the Node build of `ws` (requiring core modules
// like zlib/stream that don't exist in React Native). Disabling it restores
// the legacy browser/react-native field resolution where `ws` is shimmed, so
// supabase-js bundles cleanly on device.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
