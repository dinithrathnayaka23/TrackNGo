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

  return {
    ...config,
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
