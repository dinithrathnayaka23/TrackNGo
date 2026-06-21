package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.dto.PresenceDto;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChatPresenceServiceTest {

    private final ChatPresenceService service = new ChatPresenceService();

    /** Verifies that marking a session online adds the user to the live presence snapshot. */
    @Test
    void markOnlineShouldTrackUserAndSession() {
        PresenceDto result = service.markOnline("session-1", 10L);

        assertEquals(10L, result.getUserId());
        assertTrue(result.isOnline());
        assertEquals(Set.of("session-1"), service.getSessionIdsForUser(10L));
        assertEquals(1, result.getOnlineUserIds().size());
    }

    /** Verifies that a user stays online while at least one of their sessions is still connected. */
    @Test
    void markOfflineShouldKeepUserOnlineWhenAnotherSessionExists() {
        service.markOnline("session-1", 10L);
        service.markOnline("session-2", 10L);

        PresenceDto result = service.markOffline("session-1");

        assertEquals(10L, result.getUserId());
        assertTrue(result.isOnline());
        assertEquals(Set.of("session-2"), service.getSessionIdsForUser(10L));
    }

    /** Verifies that moving a session from one user to another cleans up the previous user's session mapping. */
    @Test
    void markOnlineShouldMoveSessionBetweenUsers() {
        service.markOnline("session-1", 10L);

        PresenceDto result = service.markOnline("session-1", 20L);

        assertEquals(20L, result.getUserId());
        assertEquals(Set.of(), service.getSessionIdsForUser(10L));
        assertEquals(Set.of("session-1"), service.getSessionIdsForUser(20L));
    }

    /** Verifies that unknown offline session events are ignored safely. */
    @Test
    void markOfflineShouldReturnNullForUnknownSession() {
        assertNull(service.markOffline("missing-session"));
    }

    /** Verifies that user and global presence snapshots reflect the currently connected users. */
    @Test
    void snapshotMethodsShouldReturnCurrentPresenceState() {
        service.markOnline("session-1", 10L);
        service.markOnline("session-2", 20L);

        PresenceDto userSnapshot = service.snapshotFor(10L);
        PresenceDto globalSnapshot = service.snapshot();

        assertEquals(10L, userSnapshot.getUserId());
        assertTrue(userSnapshot.isOnline());
        assertEquals(2, globalSnapshot.getOnlineUserIds().size());
    }
}
