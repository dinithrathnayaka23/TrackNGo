const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

function readRootEnvValue(key) {
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) return undefined;

  const content = fs.readFileSync(envPath, 'utf8');
  const line = content
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));

  return line ? line.slice(line.indexOf('=') + 1).trim() : undefined;
}

module.exports = () => {
  const config = appJson.expo;
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    readRootEnvValue('GOOGLE_MAPS_API_KEY');
  // EAS Build's Metro bundling step does not reliably inline EXPO_PUBLIC_*
  // vars from eas.json into app source (verified by inspecting a built APK -
  // the value never reached the JS bundle). Baking it into `extra` here
  // instead means config/env.ts can read it from Constants.expoConfig at
  // runtime, which this config-resolution step *does* reliably reach.
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL || readRootEnvValue('EXPO_PUBLIC_API_BASE_URL');

  return {
    ...config,
    extra: {
      ...config.extra,
      apiBaseUrl,
    },
    android: {
      ...config.android,
      config: googleMapsApiKey
        ? {
            ...config.android?.config,
            googleMaps: {
              ...config.android?.config?.googleMaps,
              apiKey: googleMapsApiKey,
            },
          }
        : config.android?.config,
    },
    ios: {
      ...config.ios,
      config: googleMapsApiKey
        ? {
            ...config.ios?.config,
            googleMapsApiKey,
          }
        : config.ios?.config,
    },
  };
};
