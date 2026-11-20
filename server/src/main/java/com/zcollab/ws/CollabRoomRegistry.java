package com.zcollab.ws;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Component
public class CollabRoomRegistry {

    private final ConcurrentHashMap<Long, Set<WebSocketSession>> rooms = new ConcurrentHashMap<>();

    public void register(Long docId, WebSocketSession session) {
        rooms.computeIfAbsent(docId, key -> ConcurrentHashMap.newKeySet()).add(session);
    }

    public boolean unregister(Long docId, WebSocketSession session) {
        Set<WebSocketSession> sessions = rooms.get(docId);
        if (sessions == null || !sessions.remove(session)) {
            return false;
        }
        if (sessions.isEmpty()) {
            rooms.remove(docId, sessions);
        }
        return true;
    }

    public Set<WebSocketSession> peers(Long docId, WebSocketSession self) {
        Set<WebSocketSession> sessions = rooms.get(docId);
        if (sessions == null) {
            return Set.of();
        }
        return sessions.stream()
                .filter(session -> session != self)
                .collect(Collectors.toUnmodifiableSet());
    }

    public int size(Long docId) {
        Set<WebSocketSession> sessions = rooms.get(docId);
        return sessions == null ? 0 : sessions.size();
    }

    public Map<Long, Set<WebSocketSession>> snapshot() {
        Map<Long, Set<WebSocketSession>> copy = new HashMap<>();
        rooms.forEach((docId, sessions) -> copy.put(docId, Set.copyOf(sessions)));
        return copy;
    }
}
