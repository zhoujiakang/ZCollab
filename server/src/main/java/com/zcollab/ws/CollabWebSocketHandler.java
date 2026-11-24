package com.zcollab.ws;

import com.zcollab.service.WorkspaceMemberRemoved;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.service.LoginTokenRevoked;
import org.springframework.context.event.EventListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;

import static com.zcollab.ws.CollabHandshakeInterceptor.*;

@Component
public class CollabWebSocketHandler extends BinaryWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CollabWebSocketHandler.class);
    private static final long IDLE_TIMEOUT_MS = 5 * 60_000L;
    private static final int CLOSE_IDLE_TIMEOUT = 1001;

    private final CollabRoomRegistry registry;
    private final CollabSyncService syncService;
    private final WorkspaceMemberService members;

    public CollabWebSocketHandler(CollabRoomRegistry registry, CollabSyncService syncService,
                                  WorkspaceMemberService members) {
        this.registry = registry;
        this.syncService = syncService;
        this.members = members;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Map<String, Object> attributes = session.getAttributes();
        int closeCode = (Integer) attributes.getOrDefault(ATTR_CLOSE_CODE, CLOSE_SERVER_ERROR);
        if (closeCode != CLOSE_OK) {
            String reason = (String) attributes.getOrDefault(ATTR_CLOSE_REASON, "握手校验失败");
            log.info("WebSocket 握手校验失败，关闭连接 {}：{} ({})", session.getId(), reason, closeCode);
            close(session, closeCode, reason);
            return;
        }

        Long docId = (Long) attributes.get(ATTR_DOC_ID);
        attributes.put(ATTR_LAST_ACTIVE_AT, new AtomicLong(System.currentTimeMillis()));
        registry.register(docId, session);
        // 注册之后再检查，覆盖握手通过到入房之间成员已被移除的情况。
        if (!requireMembership(session)) return;
        log.info("文档 {} 在线 {} 人", docId, registry.size(docId));
        syncService.onClientJoin(docId, session);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        if (!session.isOpen() || !requireMembership(session)) return;
        touch(session);
        Long docId = (Long) session.getAttributes().get(ATTR_DOC_ID);
        if (docId != null) {
            ByteBuffer payload = message.getPayload();
            byte[] bytes = new byte[payload.remaining()];
            payload.get(bytes);
            syncService.handleFrame(docId, bytes, session);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        if (!session.isOpen() || !requireMembership(session)) return;
        touch(session);
    }

    /** AFTER_COMMIT avoids disconnecting a member when the removal transaction rolls back. */
    @TransactionalEventListener(fallbackExecution = true)
    public void onMemberRemoved(WorkspaceMemberRemoved event) {
        for (Set<WebSocketSession> sessions : registry.snapshot().values()) {
            for (WebSocketSession session : sessions) {
                Map<String, Object> attributes = session.getAttributes();
                if (event.workspaceId().equals(attributes.get(ATTR_WORKSPACE_ID))
                        && Long.valueOf(event.userId()).equals(attributes.get(ATTR_USER_ID))) {
                    close(session, CLOSE_UNAUTHORIZED, "已退出或被移出工作区");
                    removeAndLog(session);
                }
            }
        }
    }

    private boolean requireMembership(WebSocketSession session) {
        if (!CollabSessionToken.isValid(session)) {
            close(session, CLOSE_UNAUTHORIZED, "登录已失效");
            removeAndLog(session);
            return false;
        }
        Long workspaceId = (Long) session.getAttributes().get(ATTR_WORKSPACE_ID);
        Long userId = (Long) session.getAttributes().get(ATTR_USER_ID);
        if (workspaceId != null && userId != null && members.findMembership(workspaceId, userId) != null) {
            return true;
        }
        close(session, CLOSE_UNAUTHORIZED, "没有工作区访问权限");
        removeAndLog(session);
        return false;
    }

    @EventListener
    public void onTokenRevoked(LoginTokenRevoked event) {
        for (Set<WebSocketSession> sessions : registry.snapshot().values()) {
            for (WebSocketSession session : sessions) {
                if (event.token() != null && event.token().equals(session.getAttributes().get(ATTR_TOKEN))) {
                    close(session, CLOSE_UNAUTHORIZED, "登录已失效");
                    removeAndLog(session);
                }
            }
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WebSocket 传输异常，session={}", session.getId(), exception);
        close(session, CLOSE_SERVER_ERROR, "传输异常");
        removeAndLog(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        removeAndLog(session);
    }

    @Scheduled(fixedDelay = 30_000)
    public void closeIdleSessions() {
        long now = System.currentTimeMillis();
        for (Map.Entry<Long, Set<WebSocketSession>> entry : registry.snapshot().entrySet()) {
            Long docId = entry.getKey();
            for (WebSocketSession session : entry.getValue()) {
                if (!CollabSessionToken.isValid(session)) {
                    close(session, CLOSE_UNAUTHORIZED, "登录已失效");
                    removeAndLog(session);
                    continue;
                }
                AtomicLong lastActive = (AtomicLong) session.getAttributes().get(ATTR_LAST_ACTIVE_AT);
                long last = lastActive == null ? 0L : lastActive.get();
                if (now - last >= IDLE_TIMEOUT_MS) {
                    log.info("文档 {} 的连接 {} 闲置超过 5 分钟，主动关闭", docId, session.getId());
                    close(session, CLOSE_IDLE_TIMEOUT, "idle timeout");
                    removeAndLog(session);
                }
            }
        }
    }

    private void touch(WebSocketSession session) {
        AtomicLong lastActive = (AtomicLong) session.getAttributes().get(ATTR_LAST_ACTIVE_AT);
        if (lastActive != null) {
            lastActive.set(System.currentTimeMillis());
        }
    }

    private void removeAndLog(WebSocketSession session) {
        Long docId = (Long) session.getAttributes().get(ATTR_DOC_ID);
        if (docId != null && registry.unregister(docId, session)) {
            syncService.onClientLeft(docId, session);
            log.info("文档 {} 在线 {} 人", docId, registry.size(docId));
        }
    }

    private void close(WebSocketSession session, int code, String reason) {
        try {
            if (session.isOpen()) {
                session.close(new CloseStatus(code, reason));
            }
        } catch (IOException e) {
            log.warn("关闭 WebSocket 连接失败，session={}", session.getId(), e);
        }
    }
}
