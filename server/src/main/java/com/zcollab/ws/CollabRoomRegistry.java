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
        rooms.compute(docId, (key, sessions) -> {
            if (sessions == null) sessions = ConcurrentHashMap.newKeySet();
            sessions.add(session);
            return sessions;
        });
    }

    public boolean unregister(Long docId, WebSocketSession session) {
        boolean[] removed = {false};
        rooms.computeIfPresent(docId, (key, sessions) -> {
            removed[0] = sessions.remove(session);
            return sessions.isEmpty() ? null : sessions;
        });
        return removed[0];
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
