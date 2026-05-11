const appJson = require('./app.json');

const EXPO_DEV_CLIENT_PLUGIN = 'expo-dev-client';
const LOCAL_IOS_SIGNING_PLUGIN = './plugins/with-local-ios-signing';

function upsertPlugin(plugins, plugin, options) {
  const current = Array.isArray(plugins) ? plugins : [];
  const nextEntry = options ? [plugin, options] : plugin;
  const existingIndex = current.findIndex((entry) => {
    if (Array.isArray(entry)) {
      return entry[0] === plugin;
    }
    return entry === plugin;
  });

  if (existingIndex === -1) {
    return [...current, nextEntry];
  }

  return [
    ...current.slice(0, existingIndex),
    nextEntry,
    ...current.slice(existingIndex + 1),
  ];
}

module.exports = ({ config }) => {
  const expoConfig = config ?? appJson.expo;
  const bundleIdentifier =
    process.env.EXPO_IOS_BUNDLE_IDENTIFIER || expoConfig.ios?.bundleIdentifier;
  const appleTeamId = process.env.EXPO_IOS_APPLE_TEAM_ID;
  const pluginsWithDevClient = upsertPlugin(expoConfig.plugins, EXPO_DEV_CLIENT_PLUGIN, {
    // Open the launcher instead of silently reconnecting to the last LAN URL.
    launchMode: 'launcher',
  });

  return {
    ...expoConfig,
    ios: {
      ...expoConfig.ios,
      bundleIdentifier,
      ...(appleTeamId ? { appleTeamId } : {}),
    },
    plugins: upsertPlugin(pluginsWithDevClient, LOCAL_IOS_SIGNING_PLUGIN),
  };
};
