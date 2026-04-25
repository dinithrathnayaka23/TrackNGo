# Complaint Module Unit Test Guide

This module now uses JUnit 5 and Mockito for complaint-related unit testing.

## Test Folder Structure

```text
complaint-module/
|-- src/
|   |-- main/java/com/trackngo/complaint/...
|   `-- test/java/com/trackngo/complaint/internal/service/
|       |-- ComplaintServiceImplTest.java
|       `-- AdminComplaintServiceTest.java
|-- pom.xml
`-- TESTING.md
```

## What Is Covered

- `ComplaintServiceImplTest`
  - complaint creation for a valid passenger booking
  - rejection when the booking reference is missing
  - rejection when the booking is still in the future
  - passenger complaint retrieval for the `mine` flow
  - complaint update and automatic resolved timestamp handling
  - not-found handling during updates

- `AdminComplaintServiceTest`
  - admin complaint list mapping
  - admin complaint status update and response trimming
  - invalid admin status rejection
  - complaint detail mapping with JSON image parsing
  - not-found handling for complaint detail lookup

## How To Run

From the backend parent directory:

```bash
mvn -pl complaint-module test
```

From the complaint module directory:

```bash
mvn test
```

Run only one test class:

```bash
mvn -pl complaint-module -Dtest=ComplaintServiceImplTest test
mvn -pl complaint-module -Dtest=AdminComplaintServiceTest test
```

## Notes

- These are unit tests, so database access and repository behavior are mocked with Mockito.
- The tests focus on service-layer business rules because that is where most complaint validation and mapping logic lives.
- Production complaint methods and test methods now include short comments so it is easier to understand each responsibility quickly.
