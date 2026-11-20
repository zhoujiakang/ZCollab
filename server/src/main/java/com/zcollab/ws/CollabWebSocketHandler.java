package com.zcollab.ws;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
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

    public CollabWebSocketHandler(CollabRoomRegistry registry, CollabSyncService syncService) {
        this.registry = registry;
        this.syncService = syncService;
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
        log.info("文档 {} 有人加入，当前 {} 人", docId, registry.size(docId));
        syncService.onClientJoin(docId, session);
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
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
        touch(session);
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
            log.info("文档 {} 有人离开，当前 {} 人", docId, registry.size(docId));
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
