# SOS Module Unit Test Guide

This module now includes JUnit 5 and Mockito unit tests for backend SOS logic.

## Test Folder Structure

```text
sos-module/
|-- src/
|   |-- main/java/com/trackngo/sos/...
|   `-- test/java/com/trackngo/sos/internal/service/
|       |-- EmergencyContactServiceImplTest.java
|       |-- EmergencyNumberServiceImplTest.java
|       `-- SosAlertServiceImplTest.java
|-- pom.xml
`-- TESTING.md
```

## What Is Covered

- emergency contact listing, creation, normalization, and deletion rules
- active emergency number retrieval and admin list behavior
- emergency number creation and update validation
- protection against deactivating the last active emergency number row
- SOS alert trigger validation for passenger or driver ownership
- bus-detail enrichment and emergency-contact SMS notification flow
- active SOS alert mapping for the admin dashboard
- resolving and dismissing SOS alerts

## How To Run

From the backend parent directory:

```bash
mvn -pl sos-module test
```

From the SOS module directory:

```bash
mvn test
```

Run only one SOS service test class:

```bash
mvn -pl sos-module -Dtest=EmergencyContactServiceImplTest test
mvn -pl sos-module -Dtest=EmergencyNumberServiceImplTest test
mvn -pl sos-module -Dtest=SosAlertServiceImplTest test
```

## Notes

- These are unit tests, so repository, JDBC, and SMS provider interactions are mocked with Mockito.
- The tests focus on the SOS service layer because the main validation, enrichment, and notification rules live there.
- SOS-related production methods and test methods include short comments for quick understanding.
