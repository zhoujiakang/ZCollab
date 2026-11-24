package com.zcollab.ws;

import com.zcollab.core.store.InMemoryDocStore;
import com.zcollab.service.WorkspaceMemberRemoved;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

import static com.zcollab.ws.CollabHandshakeInterceptor.*;
import static org.junit.jupiter.api.Assertions.*;

class CollabWebSocketHandlerTest {
    @Test
    void removalClosesAllTargetConnectionsButKeepsOtherMembersAndWorkspaces() throws Exception {
        Harness h = new Harness();
        Session first = new Session("first", 42, 7, 9);
        Session second = new Session("second", 43, 7, 9);
        Session peer = new Session("peer", 42, 7, 10);
        Session otherWorkspace = new Session("other", 44, 8, 9);
        for (Session session : List.of(first, second, peer, otherWorkspace)) {
            h.handler.afterConnectionEstablished(session.socket);
            session.messages.clear();
        }

        h.handler.onMemberRemoved(new WorkspaceMemberRemoved(7L, 9));
        assertFalse(first.open);
        assertFalse(second.open);
        assertEquals(4401, first.status.getCode());
        assertTrue(peer.open);
        assertTrue(otherWorkspace.open);
        assertEquals(1, h.registry.size(42L));
        assertEquals(0, h.registry.size(43L));

        h.handler.handleMessage(first.socket, update());
        assertTrue(h.store.readUpdates(42).isEmpty());
        h.handler.handleMessage(peer.socket, update());
        assertEquals(1, h.store.readUpdates(42).size());
        assertTrue(first.messages.isEmpty());
    }

    @Test
    void rejectsMemberRemovedBetweenHandshakeAndRoomRegistration() {
        Harness h = new Harness();
        h.allowed.set(false);
        Session session = new Session("late", 42, 7, 9);
        h.handler.afterConnectionEstablished(session.socket);
        assertFalse(session.open);
        assertEquals(0, h.registry.size(42L));
        assertTrue(session.messages.isEmpty());
    }

    @Test
    void nextFrameRechecksMembershipEvenWithoutRemovalEvent() throws Exception {
        Harness h = new Harness();
        Session session = new Session("member", 42, 7, 9);
        h.handler.afterConnectionEstablished(session.socket);
        h.allowed.set(false);
        h.handler.handleMessage(session.socket, update());
        assertFalse(session.open);
        assertEquals(0, h.registry.size(42L));
        assertTrue(h.store.readUpdates(42).isEmpty());
    }

    private static BinaryMessage update() {
        return new BinaryMessage(new byte[]{0, 2, 2, 1, 1});
    }

    private static class Harness {
        final AtomicBoolean allowed = new AtomicBoolean(true);
        final InMemoryDocStore store = new InMemoryDocStore();
        final CollabRoomRegistry registry = new CollabRoomRegistry();
        final CollabSyncService sync = new CollabSyncService(registry, store);
        final WorkspaceMemberService members = (WorkspaceMemberService) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{WorkspaceMemberService.class},
                (proxy, method, args) -> allowed.get() ? new WorkspaceMembership((Long) args[0], "member") : null);
        final CollabWebSocketHandler handler = new CollabWebSocketHandler(registry, sync, members);
    }

    private static class Session {
        boolean open = true;
        CloseStatus status;
        final List<Object> messages = new ArrayList<>();
        final Map<String, Object> attributes = new HashMap<>();
        final WebSocketSession socket;

        Session(String id, long docId, long workspaceId, long userId) {
            attributes.put(ATTR_CLOSE_CODE, CLOSE_OK);
            attributes.put(ATTR_DOC_ID, docId);
            attributes.put(ATTR_WORKSPACE_ID, workspaceId);
            attributes.put(ATTR_USER_ID, userId);
            socket = (WebSocketSession) Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{WebSocketSession.class}, (proxy, method, args) -> switch (method.getName()) {
                        case "getId" -> id;
                        case "getAttributes" -> attributes;
                        case "isOpen" -> open;
                        case "close" -> { open = false; status = (CloseStatus) args[0]; yield null; }
                        case "sendMessage" -> { messages.add(args[0]); yield null; }
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == args[0];
                        case "toString" -> id;
                        default -> throw new UnsupportedOperationException(method.getName());
                    });
        }
    }
}
