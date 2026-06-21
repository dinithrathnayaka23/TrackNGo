# Promotion Module Unit Test Guide

This module now includes JUnit 5 and Mockito unit tests for backend promotion logic.

## Test Folder Structure

```text
booking-module/
|-- src/
|   |-- main/java/com/trackngo/booking/...
|   `-- test/java/com/trackngo/booking/internal/service/
|       `-- PromotionServiceTest.java
|-- pom.xml
`-- TESTING.md
```

## What Is Covered

- promotion creation with normalized admin input
- validation for missing promo codes on promo-code promotions
- deletion protection for active promotions
- automatic selection of the best eligible promotion quote
- rejection of invalid promo codes
- successful promotion redemption
- redemption failure when the promotion is no longer available

## How To Run

From the backend parent directory:

```bash
mvn -pl booking-module test
```

From the booking module directory:

```bash
mvn test
```

Run only the promotion service tests:

```bash
mvn -pl booking-module -Dtest=PromotionServiceTest test
```

## Notes

- These are unit tests, so database interactions are mocked with Mockito.
- The tests focus on `PromotionService` because the main promotion validation, quoting, and redemption rules live there.
- Promotion-related production methods and test methods include short comments for quick understanding.
