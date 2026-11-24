package com.zcollab.ws;

import com.zcollab.core.protocol.Lib0Codec;
import com.zcollab.core.protocol.SyncMessageType;
import com.zcollab.core.store.DocStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** Yjs sync relay backed by DocStore: one write lock per document. */
@Service
public class CollabSyncService {

    private static final Logger log = LoggerFactory.getLogger(CollabSyncService.class);

    /** y-websocket outer message types. */
    private static final int MESSAGE_SYNC = 0;
    private static final int MESSAGE_AWARENESS = 1;
    private static final int MESSAGE_QUERY_AWARENESS = 3;

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

    private record AwarenessEntry(int clock, String stateJson) {
    }

    private record AwarenessWireEntry(int clientId, int clock, String stateJson) {
    }

    private final DocStore store;
    private final CollabRoomRegistry registry;
    private final ConcurrentHashMap<Long, Object> docLocks = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ConcurrentHashMap<Integer, AwarenessEntry>> awarenessBySession =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, ConcurrentHashMap<Integer, String>> awarenessOwnersByDoc =
            new ConcurrentHashMap<>();

    public CollabSyncService(CollabRoomRegistry registry, DocStore store) {
        this.registry = registry;
        this.store = store;
    }

    /** 鉴权通过后服务端主动发 STEP_1，随后把房间内所有连接的 awareness 拼成一帧发给新连接。 */
    public void onClientJoin(long docId, WebSocketSession session) {
        withDocLock(docId, () -> {
            send(session, syncFrame(EMPTY_STEP_1_MESSAGE));
            List<AwarenessWireEntry> entries = roomAwarenessEntries(docId);
            send(session, awarenessFrame(entries));
            log.info("文档 {} 向新连接 {} 主动发送 step1 和 {} 条 awareness",
                    docId, session.getId(), entries.size());
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
        if (outerType == MESSAGE_AWARENESS) {
            handleAwareness(docId, in, payload, self);
            return;
        }
        if (outerType == MESSAGE_QUERY_AWARENESS) {
            answerAwarenessQuery(docId, self);
            return;
        }
        if (outerType != MESSAGE_SYNC) {
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
        if (isEmptyUpdate(update)) {
            log.info("文档 {} 收到空 update，忽略", docId);
            return;
        }

        switch (subtype) {
            case STEP_1 -> {
                withDocLock(docId, () -> {
                    var state = store.readState(docId);
                    byte[] snapshot = state.snapshot();
                    send(self, syncFrame(SyncMessageType.STEP_2,
                            snapshot != null ? snapshot : EMPTY_UPDATE));
                    List<byte[]> stored = state.updates();
                    for (byte[] known : stored) {
                        send(self, syncFrame(SyncMessageType.UPDATE, known));
                    }
                    log.info("文档 {} 收到 step1，step2 搭载快照={}，并重放 {} 条增量 update",
                            docId, snapshot != null, stored.size());
                });
            }
            case STEP_2, UPDATE -> withDocLock(docId, () -> {
                store.appendUpdate(docId, update);
                byte[] outgoing = syncFrame(SyncMessageType.UPDATE, update);
                Set<WebSocketSession> peers = registry.peers(docId, self);
                for (WebSocketSession peer : peers) {
                    send(peer, outgoing);
                }
                log.info("文档 {} 收到 {}，以 UPDATE 转发给 {} 个连接", docId, subtype, peers.size());
            });
        }
    }

    private static boolean isEmptyUpdate(byte[] update) {
        return update.length == 0 || (update.length == 2 && update[0] == 0 && update[1] == 0);
    }

    private void handleAwareness(long docId, ByteBuffer in, byte[] rawFrame, WebSocketSession self) {
        List<AwarenessWireEntry> entries;
        try {
            byte[] awarenessUpdate = Lib0Codec.readVarUint8Array(in);
            ByteBuffer body = ByteBuffer.wrap(awarenessUpdate);
            int count = Lib0Codec.readVarUint(body);
            if (count < 0 || count > body.remaining()) {
                throw new IllegalArgumentException("invalid awareness entry count: " + count);
            }
            entries = new ArrayList<>(count);
            for (int i = 0; i < count; i++) {
                int clientId = Lib0Codec.readVarUint(body);
                int clock = Lib0Codec.readVarUint(body);
                String stateJson = Lib0Codec.readVarString(body);
                entries.add(new AwarenessWireEntry(clientId, clock, stateJson));
            }
        } catch (IllegalArgumentException e) {
            log.warn("文档 {} 收到非法 awareness 帧，丢弃：{}", docId, e.getMessage());
            return;
        }

        ConcurrentHashMap<Integer, AwarenessEntry> own = awarenessBySession.computeIfAbsent(
                self.getId(), ignored -> new ConcurrentHashMap<>());
        ConcurrentHashMap<Integer, String> owners =
                awarenessOwnersByDoc.computeIfAbsent(docId, ignored -> new ConcurrentHashMap<>());
        int accepted = 0;
        for (AwarenessWireEntry entry : entries) {
            String owner = owners.computeIfAbsent(entry.clientId(), ignored -> self.getId());
            if (!owner.equals(self.getId())) {
                continue;
            }
            own.put(entry.clientId(), new AwarenessEntry(entry.clock(), entry.stateJson()));
            accepted++;
        }

        Set<WebSocketSession> peers = registry.peers(docId, self);
        for (WebSocketSession peer : peers) {
            send(peer, rawFrame);
        }
        log.info("文档 {} 收到 {} 条 awareness（本连接 {} 条），原帧转发给 {} 个连接",
                docId, entries.size(), accepted, peers.size());
    }

    private void answerAwarenessQuery(long docId, WebSocketSession self) {
        List<AwarenessWireEntry> entries = roomAwarenessEntries(docId);
        send(self, awarenessFrame(entries));
        log.info("文档 {} 回答 awareness 查询，返回 {} 条条目", docId, entries.size());
    }

    /** Called after the session has been removed from its room. */
    public void onClientLeft(long docId, WebSocketSession session) {
        ConcurrentHashMap<Integer, AwarenessEntry> own = awarenessBySession.remove(session.getId());
        if (own == null || own.isEmpty()) {
            return;
        }
        ConcurrentHashMap<Integer, String> owners = awarenessOwnersByDoc.get(docId);
        List<AwarenessWireEntry> leaves = new ArrayList<>(own.size());
        for (Map.Entry<Integer, AwarenessEntry> item : own.entrySet()) {
            if (owners != null) {
                owners.remove(item.getKey(), session.getId());
            }
            leaves.add(new AwarenessWireEntry(item.getKey(), item.getValue().clock() + 1, "null"));
        }
        byte[] frame = awarenessFrame(leaves);
        Set<WebSocketSession> peers = registry.peers(docId, session);
        for (WebSocketSession peer : peers) {
            send(peer, frame);
        }
        log.info("文档 {} 连接 {} 离开，向 {} 个连接广播 {} 条 null awareness",
                docId, session.getId(), peers.size(), leaves.size());
    }

    private List<AwarenessWireEntry> roomAwarenessEntries(long docId) {
        List<AwarenessWireEntry> entries = new ArrayList<>();
        // peers(docId, null) 表示该房间的全部连接，包括查询者自己。
        for (WebSocketSession session : registry.peers(docId, null)) {
            ConcurrentHashMap<Integer, AwarenessEntry> own = awarenessBySession.get(session.getId());
            if (own == null) {
                continue;
            }
            for (Map.Entry<Integer, AwarenessEntry> item : own.entrySet()) {
                AwarenessEntry value = item.getValue();
                entries.add(new AwarenessWireEntry(item.getKey(), value.clock(), value.stateJson()));
            }
        }
        return entries;
    }

    private static byte[] awarenessFrame(List<AwarenessWireEntry> entries) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(body, entries.size());
        for (AwarenessWireEntry entry : entries) {
            Lib0Codec.writeVarUint(body, entry.clientId());
            Lib0Codec.writeVarUint(body, entry.clock());
            Lib0Codec.writeVarString(body, entry.stateJson());
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(out, MESSAGE_AWARENESS);
        Lib0Codec.writeVarUint8Array(out, body.toByteArray());
        return out.toByteArray();
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
