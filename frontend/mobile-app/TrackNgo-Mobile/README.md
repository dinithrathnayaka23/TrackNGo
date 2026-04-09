# trackNGo Chat Frontend (Expo + TypeScript)

## Run

1. Install dependencies:
```bash
npm install
```

If this is your first run after upgrading to SDK 54, sync Expo-compatible package versions:
```bash
npx expo install --fix
```

2. Start Expo:
```bash
npm run android
```

3. Optional base URL override:
```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8081 npm start
```

Default API URL is `http://10.0.2.2:8081` for Android emulator.

## Implemented

- Mock user selection screen (ID + role) with AsyncStorage persistence
- Chat list with backend pagination and backend search endpoint
- Chat room with:
  - WebSocket STOMP over SockJS
  - realtime message updates
  - typing indicator in header
  - status updates (`SENT`, `DELIVERED`, `READ`) with WhatsApp-style ticks
  - image upload + send
  - in-app audio record + upload + playback
  - REST pagination for older messages
