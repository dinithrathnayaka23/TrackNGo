# Mobile Complaint Screen Test Guide

This mobile app now includes Jest unit tests for the complaint submission screen.

## Test Folder Structure

```text
TrackNgo-Mobile/
|-- __tests__/
|   `-- app/
|       `-- booking/
|           `-- complaint-screen.test.tsx
|-- app/
|   `-- booking/
|       `-- complaint.tsx
|-- jest.setup.ts
`-- package.json
```

## What Is Covered

- complaint history loading and label mapping
- submit validation for missing complaint category
- successful complaint submission
- submit failure handling
- helper conversion logic for complaint type values and image extensions

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

## Notes

- The tests mock Expo Router, image picker behavior, session state, and complaint API calls.
- These are unit tests, so they validate the screen logic without requiring a running backend.
- Complaint-related production functions now include short comments to explain each responsibility quickly.
