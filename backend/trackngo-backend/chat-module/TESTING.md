# Chat Module Unit Test Guide

This module now includes JUnit 5 and Mockito unit tests for backend chat logic.

## Test Folder Structure

```text
chat-module/
|-- src/
|   |-- main/java/com/trackngo/chat/...
|   `-- test/java/com/trackngo/chat/internal/service/
|       |-- ChatPresenceServiceTest.java
|       |-- ConversationServiceImplTest.java
|       `-- MessageServiceImplTest.java
|-- pom.xml
`-- TESTING.md
```

## What Is Covered

- conversation lookup and creation between participants
- participant-type resolution and unread-counter initialization
- user and support conversation paging
- chat message validation, send flow, and event publishing
- automatic conversation creation during first message send
- message paging and DTO status mapping
- mark-as-read behavior and unread-counter resets
- soft deletion rules and conversation preview refresh
- live chat presence session tracking and presence snapshots

## How To Run

From the backend parent directory:

```bash
mvn -pl chat-module test
```

From the chat module directory:

```bash
mvn test
```

Run only one chat test class:

```bash
mvn -pl chat-module -Dtest=ConversationServiceImplTest test
mvn -pl chat-module -Dtest=MessageServiceImplTest test
mvn -pl chat-module -Dtest=ChatPresenceServiceTest test
```

## Notes

- These are unit tests, so repositories and event publishing are mocked with Mockito.
- The tests focus on the chat service layer because the main conversation, message, and presence rules live there.
- Chat-related production methods and test methods include short comments for quick understanding.
