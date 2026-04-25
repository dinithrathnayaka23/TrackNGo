# Mobile Booking And Complaint Test Guide

This mobile app now includes Jest unit tests for both the complaint flow and the promotion flow used in booking.

## Test Folder Structure

```text
TrackNgo-Mobile/
|-- __tests__/
|   |-- app/
|   |   `-- booking/
|   |       |-- complaint-screen.test.tsx
|   |       `-- booking-summary-promotion.test.tsx
|   `-- services/
|       `-- bookingFlowApi.test.ts
|-- app/
|   `-- booking/
|       |-- complaint.tsx
|       `-- booking-summary.tsx
|-- services/
|   `-- bookingFlowApi.ts
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

## Notes

- The tests mock Expo Router, image picker behavior, session state, and complaint API calls.
- The booking summary promotion tests mock profile loading, session state, and promotion quote responses.
- These are unit tests, so they validate the screen logic without requiring a running backend.
- Complaint-related and promotion-related production functions now include short comments to explain each responsibility quickly.
