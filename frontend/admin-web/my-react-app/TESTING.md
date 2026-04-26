# Admin Dashboard Test Guide

This admin web app now includes unit tests for complaint, promotion, chat, and SOS dashboard flows.

## Test Folder Structure

```text
my-react-app/
|-- src/
|   |-- __tests__/
|   |   |-- components/SosAlertPopup.test.tsx
|   |   |-- pages/dashboard/Chat.test.tsx
|   |   |-- pages/dashboard/Complaints.test.tsx
|   |   |-- pages/dashboard/Promotions.test.tsx
|   |   |-- services/chatAdminService.test.ts
|   |   |-- services/complaintService.test.ts
|   |   |-- services/promotionService.test.ts
|   |   `-- services/sosAlertService.test.ts
|   |-- components/SosAlertPopup.tsx
|   |-- pages/dashboard/Chat.tsx
|   |-- pages/dashboard/Complaints.tsx
|   |-- pages/dashboard/Promotions.tsx
|   |-- services/chatAdminService.ts
|   |-- services/complaintService.ts
|   |-- services/promotionService.ts
|   `-- services/sosAlertService.ts
|-- src/test/setup.ts
`-- TESTING.md
```

## What Is Covered

- complaint list loading and dashboard summary counts
- complaint filtering by passenger name and status
- complaint detail modal loading and evidence image rendering
- complaint update flow for admin review actions
- complaint service API calls and id normalization
- helper logic for status conversion and date or image formatting
- promotion list loading and dashboard summary counts
- promotion form validation and normalized creation payloads
- promotion edit, cancel, and remove actions
- promotion service API calls for list, create, update, cancel, and delete
- helper logic for promotion badge styling, form mapping, and discount formatting
- admin chat inbox loading, active-thread selection, and message rendering
- admin chat conversation filtering and support reply submission
- admin chat service API calls for inbox loading, message send, read, delete, presence, profile, and media upload
- helper logic for chat participant labels, asset URLs, previews, date formatting, and optimistic message merging
- SOS alert popup loading, minimizing, reopening, and status updates
- SOS emergency-number shortcut rendering and emergency-contact display
- SOS service API calls for active alerts, active emergency numbers, and alert status updates
- helper logic for SOS GPS parsing and time formatting

## How To Run

Install dependencies if needed:

```bash
npm install
```

Run all admin web tests:

```bash
npm test
```

Run only the complaint tests:

```bash
npx vitest run src/__tests__/pages/dashboard/Complaints.test.tsx
npx vitest run src/__tests__/services/complaintService.test.ts
```

Run only the promotion tests:

```bash
npx vitest run src/__tests__/pages/dashboard/Promotions.test.tsx
npx vitest run src/__tests__/services/promotionService.test.ts
```

Run only the chat tests:

```bash
npx vitest run src/__tests__/pages/dashboard/Chat.test.tsx
npx vitest run src/__tests__/services/chatAdminService.test.ts
```

Run only the SOS tests:

```bash
npx vitest run src/__tests__/components/SosAlertPopup.test.tsx
npx vitest run src/__tests__/services/sosAlertService.test.ts
```

## Notes

- The page tests mock the complaint service and PDF libraries so they stay focused on complaint UI behavior.
- The promotion page tests mock the promotion service so they stay focused on admin workflow behavior.
- The chat page tests mock the admin chat service and websocket layer so they stay focused on inbox workflow behavior.
- The SOS popup tests mock the SOS service so they stay focused on alert workflow behavior.
- The service tests mock `fetch` and verify the admin complaint, promotion, chat, and SOS endpoints directly.
- Complaint-related, promotion-related, chat-related, and SOS-related production functions now include short comments to explain each responsibility quickly.
