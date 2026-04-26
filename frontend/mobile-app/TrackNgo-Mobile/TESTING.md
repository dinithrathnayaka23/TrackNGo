# Mobile Booking, Chat, And SOS Test Guide

This mobile app now includes Jest unit tests for complaint, promotion, chat, and SOS flows.

## Test Folder Structure

```text
TrackNgo-Mobile/
|-- __tests__/
|   |-- app/
|   |   `-- booking/
|   |       |-- complaint-screen.test.tsx
|   |       `-- booking-summary-promotion.test.tsx
|   |-- screens/
|   |   |-- chat/
|   |   |   |-- ChatListScreen.test.tsx
|   |   |   `-- ChatRoomScreen.helpers.test.ts
|   |-- screens/
|   |   `-- sos/
|   |       |-- EmergencyContactsScreen.test.tsx
|   |       `-- SosScreen.test.tsx
|   |-- utils/
|   |   `-- chat.test.ts
|   `-- services/
|       |-- bookingFlowApi.test.ts
|       |-- chatApi.test.ts
|       |-- emergencyContactApi.test.ts
|       |-- smsService.test.ts
|       `-- sosApi.test.ts
|-- app/
|   `-- booking/
|       |-- complaint.tsx
|       `-- booking-summary.tsx
|-- screens/
|   |-- chat/
|   |   |-- ChatListScreen.tsx
|   |   `-- ChatRoomScreen.tsx
|   `-- sos/
|       |-- EmergencyContactsScreen.tsx
|       `-- SosScreen.tsx
|-- services/
|   |-- bookingFlowApi.ts
|   |-- chatApi.ts
|   |-- emergencyContactApi.ts
|   |-- smsService.ts
|   `-- sosApi.ts
|-- utils/
|   `-- chat.ts
|-- jest.setup.ts
`-- package.json
```

## What Is Covered

- complaint history loading and label mapping
- submit validation for missing complaint category
- successful complaint submission
- submit failure handling
- helper conversion logic for complaint type values and image extensions
- automatic promotion quote loading on the booking summary screen
- manual promo code application and checkout parameter forwarding
- promo code failure handling and automatic reset behavior
- promotion quote API parsing and backend error propagation
- chat-list loading, participant-title mapping, and conversation navigation
- chat-list search filtering with pinned support-chat behavior
- shared chat utility formatting, optimistic message merging, and status updates
- chat API endpoint wiring for list, create, send, read, upload, presence, and delete flows
- chat-room helper logic for presence matching, duration formatting, status ranking, and outgoing-message creation
- SOS quick-action loading and emergency-number dialing
- SOS trigger success, permission failure, and emergency-contact notification toggling
- emergency contact loading, validation, creation, and deletion
- SOS API, emergency-contact API, and direct SMS service behavior

## How To Run

Install dependencies if needed:

```bash
npm install
```

Run all Jest tests:

```bash
npm test
```

Run only the complaint screen test:

```bash
npx jest __tests__/app/booking/complaint-screen.test.tsx
```

Run only the promotion tests:

```bash
npx jest __tests__/app/booking/booking-summary-promotion.test.tsx
npx jest __tests__/services/bookingFlowApi.test.ts
```

Run only the chat tests:

```bash
npx jest __tests__/screens/chat/ChatListScreen.test.tsx
npx jest __tests__/screens/chat/ChatRoomScreen.helpers.test.ts
npx jest __tests__/services/chatApi.test.ts
npx jest __tests__/utils/chat.test.ts
```

Run only the SOS tests:

```bash
npx jest __tests__/screens/sos/SosScreen.test.tsx
npx jest __tests__/screens/sos/EmergencyContactsScreen.test.tsx
npx jest __tests__/services/sosApi.test.ts
npx jest __tests__/services/emergencyContactApi.test.ts
npx jest __tests__/services/smsService.test.ts
```

## Notes

- The tests mock Expo Router, image picker behavior, session state, and complaint API calls.
- The booking summary promotion tests mock profile loading, session state, and promotion quote responses.
- The chat tests mock websocket behavior, presence snapshots, user profiles, and API transport helpers.
- The SOS screen tests mock location permissions, device location, session state, and SOS APIs.
- The emergency-contact tests mock focus events and contact CRUD APIs.
- These are unit tests, so they validate the screen logic without requiring a running backend.
- Complaint-related, promotion-related, chat-related, and SOS-related production functions now include short comments to explain each responsibility quickly.
