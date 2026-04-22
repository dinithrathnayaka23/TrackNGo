package com.trackngo.chat.internal.service;

import com.trackngo.chat.api.dto.PresenceDto;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks chat users that currently have at least one live chat socket session.
 */
@Service
public class ChatPresenceService {

    private final Map<String, Long> userBySession = new ConcurrentHashMap<>();
    private final Map<Long, Set<String>> sessionsByUser = new ConcurrentHashMap<>();

    public synchronized PresenceDto markOnline(String sessionId, Long userId) {
        if (sessionId == null || userId == null || userId <= 0) {
            return null;
        }

        Long previousUserId = userBySession.put(sessionId, userId);
        if (previousUserId != null && !previousUserId.equals(userId)) {
            removeSession(previousUserId, sessionId);
        }

        sessionsByUser
                .computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet())
                .add(sessionId);

        return buildPresence(userId, true);
    }

    public synchronized PresenceDto markOffline(String sessionId) {
        Long userId = userBySession.remove(sessionId);
        if (userId == null) {
            return null;
        }

        boolean stillOnline = removeSession(userId, sessionId);
        return buildPresence(userId, stillOnline);
    }

    public synchronized PresenceDto snapshotFor(Long userId) {
        return buildPresence(userId, userId != null && sessionsByUser.containsKey(userId));
    }

    public synchronized PresenceDto snapshot() {
        return buildPresence(null, false);
    }

    public synchronized Set<String> getSessionIdsForUser(Long userId) {
        Set<String> sessions = sessionsByUser.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return Set.of();
        }
        return Set.copyOf(sessions);
    }

    private boolean removeSession(Long userId, String sessionId) {
        Set<String> sessions = sessionsByUser.get(userId);
        if (sessions == null) {
            return false;
        }

        sessions.remove(sessionId);
        if (sessions.isEmpty()) {
            sessionsByUser.remove(userId);
            return false;
        }
        return true;
    }

    private PresenceDto buildPresence(Long userId, boolean online) {
        return PresenceDto.builder()
                .userId(userId)
                .online(online)
                .onlineUserIds(new ArrayList<>(sessionsByUser.keySet()))
                .build();
    }
}
