# Admin Complaint Test Guide

This admin web app now includes unit tests for the complaint dashboard and complaint service.

## Test Folder Structure

```text
my-react-app/
|-- src/
|   |-- __tests__/
|   |   |-- pages/dashboard/Complaints.test.tsx
|   |   `-- services/complaintService.test.ts
|   |-- pages/dashboard/Complaints.tsx
|   `-- services/complaintService.ts
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

## Notes

- The page tests mock the complaint service and PDF libraries so they stay focused on complaint UI behavior.
- The service tests mock `fetch` and verify the admin complaint endpoints directly.
- Complaint-related production functions now include short comments to explain each responsibility quickly.
