package com.zcollab.ws;

import com.zcollab.core.protocol.Lib0Codec;
import com.zcollab.core.protocol.SyncMessageType;
import com.zcollab.core.store.DocStore;
import com.zcollab.core.store.InMemoryDocStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory Yjs sync relay: one update log and one write lock per document. */
@Service
public class CollabSyncService {

    private static final Logger log = LoggerFactory.getLogger(CollabSyncService.class);

    /** y-websocket messageSync. Other outer types (awareness, etc.) are ignored in this step. */
    private static final int MESSAGE_SYNC = 0;

    /**
     * 空 update 的实际字节，确认命令（在 client 目录执行）：
     * node -e "const Y = require('yjs'); console.log(Array.from(Y.encodeStateAsUpdate(new Y.Doc())))"
     * 输出 [ 0, 0 ]。
     */
    private static final byte[] EMPTY_UPDATE = {0, 0};

    /**
     * 空文档 STEP_1 同步消息（子类型 + varUint8Array 状态向量）的实际字节，确认命令（在 client 目录执行）：
     * node -e "const Y = require('yjs'); const encoding = require('lib0/dist/encoding.cjs'); const syncProtocol = require('y-protocols/sync'); const encoder = encoding.createEncoder(); syncProtocol.writeSyncStep1(encoder, new Y.Doc()); console.log(Array.from(encoding.toUint8Array(encoder)))"
     * 输出 [ 0, 1, 0 ]。
     */
    private static final byte[] EMPTY_STEP_1_MESSAGE = {0, 1, 0};

    private final DocStore store = new InMemoryDocStore();
    private final CollabRoomRegistry registry;
    private final ConcurrentHashMap<Long, Object> docLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, AtomicLong> nextSeq = new ConcurrentHashMap<>();

    public CollabSyncService(CollabRoomRegistry registry) {
        this.registry = registry;
    }

    /** 鉴权通过后服务端主动发 STEP_1，空状态向量让客户端回送它的完整状态。 */
    public void onClientJoin(long docId, WebSocketSession session) {
        withDocLock(docId, () -> {
            send(session, syncFrame(EMPTY_STEP_1_MESSAGE));
            log.info("文档 {} 向新连接 {} 主动发送 step1", docId, session.getId());
        });
    }

    /** 解析一帧二进制消息；非法帧只记录并丢弃，不关闭连接。 */
    public void handleFrame(long docId, byte[] payload, WebSocketSession self) {
        if (payload == null) {
            log.warn("文档 {} 收到空载荷帧，丢弃", docId);
            return;
        }
        ByteBuffer in = ByteBuffer.wrap(payload);
        int outerType;
        try {
            outerType = Lib0Codec.readVarUint(in);
        } catch (IllegalArgumentException e) {
            log.warn("文档 {} 收到长度不足的帧，丢弃：{}", docId, e.getMessage());
            return;
        }
        if (outerType != MESSAGE_SYNC) {
            // 光标等非同步消息本步不处理，静默丢弃。
            return;
        }

        SyncMessageType subtype;
        byte[] update;
        try {
            subtype = SyncMessageType.fromCode(Lib0Codec.readVarUint(in));
            update = Lib0Codec.readVarUint8Array(in);
        } catch (IllegalArgumentException e) {
            log.warn("文档 {} 收到非法同步帧，丢弃：{}", docId, e.getMessage());
            return;
        }

        switch (subtype) {
            case STEP_1 -> {
                withDocLock(docId, () -> {
                    send(self, syncFrame(SyncMessageType.STEP_2, EMPTY_UPDATE));
                    List<byte[]> stored = store.readUpdates(docId);
                    for (byte[] known : stored) {
                        send(self, syncFrame(SyncMessageType.UPDATE, known));
                    }
                    log.info("文档 {} 收到 step1，回 step2 并重放 {} 条历史 update", docId, stored.size());
                });
            }
            case STEP_2, UPDATE -> withDocLock(docId, () -> {
                store.appendUpdate(docId, update);
                long seq = nextSeq.computeIfAbsent(docId, ignored -> new AtomicLong(1)).getAndIncrement();
                byte[] outgoing = syncFrame(SyncMessageType.UPDATE, update);
                Set<WebSocketSession> peers = registry.peers(docId, self);
                for (WebSocketSession peer : peers) {
                    send(peer, outgoing);
                }
                log.info("文档 {} 收到 {}，seq={}，以 UPDATE 转发给 {} 个连接", docId, subtype, seq, peers.size());
            });
        }
    }

    private void withDocLock(long docId, Runnable action) {
        synchronized (docLocks.computeIfAbsent(docId, ignored -> new Object())) {
            action.run();
        }
    }

    private static byte[] syncFrame(SyncMessageType subtype, byte[] update) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(out, MESSAGE_SYNC);
        Lib0Codec.writeVarUint(out, subtype.getCode());
        Lib0Codec.writeVarUint8Array(out, update);
        return out.toByteArray();
    }

    private static byte[] syncFrame(byte[] syncMessage) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(out, MESSAGE_SYNC);
        out.write(syncMessage, 0, syncMessage.length);
        return out.toByteArray();
    }

    private void send(WebSocketSession session, byte[] frame) {
        synchronized (session) {
            if (!session.isOpen()) {
                return;
            }
            try {
                session.sendMessage(new BinaryMessage(frame));
            } catch (IOException | IllegalStateException e) {
                log.warn("向连接 {} 发送同步帧失败：{}", session.getId(), e.getMessage());
            }
        }
    }
}
