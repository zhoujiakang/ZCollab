package com.zcollab.ws;

import com.zcollab.core.protocol.Lib0Codec;
import com.zcollab.core.store.InMemoryDocStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketExtension;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.ByteBuffer;
import java.security.Principal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CollabSyncServiceTest {

    private static final long DOC_ID = 42L;

    private CollabRoomRegistry registry;
    private InMemoryDocStore store;
    private CollabSyncService service;

    @BeforeEach
    void setUp() {
        registry = new CollabRoomRegistry();
        store = new InMemoryDocStore();
        service = new CollabSyncService(registry, store);
    }

    @Test
    void awarenessFrameIsRecordedAndForwardedRawWithoutWritingStore() {
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);
        int clientId = (int) 3416484842L;
        byte[] frame = awarenessFrame(clientId, 5, "{\"user\":{\"name\":\"A\"}}");

        service.handleFrame(DOC_ID, frame, a);

        assertEquals(1, b.sent.size());
        assertArrayEquals(frame, b.sent.get(0));
        assertTrue(a.sent.isEmpty());
        assertTrue(store.readUpdates(DOC_ID).isEmpty());
        assertNull(store.readSnapshot(DOC_ID));
    }

    @Test
    void decodesFrameProducedByRealYProtocols() {
        // client 目录生成：node -e "const encoding=require('lib0/encoding'); ..."
        byte[] fromBrowser = {
                1, 29, 1, (byte) 234, (byte) 215, (byte) 141, (byte) 221, 12, 5, 21,
                123, 34, 117, 115, 101, 114, 34, 58, 123, 34, 110, 97, 109, 101, 34,
                58, 34, 65, 34, 125, 125
        };
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);

        service.handleFrame(DOC_ID, fromBrowser, a);

        assertEquals(1, b.sent.size());
        assertArrayEquals(fromBrowser, b.sent.get(0));
        b.sent.clear();
        service.handleFrame(DOC_ID, queryFrame(), b);
        assertEquals(List.of(new AwarenessWire((int) 3416484842L, 5, "{\"user\":{\"name\":\"A\"}}")),
                decodeAwareness(b.sent.get(0)));
    }

    @Test
    void queryAwarenessReturnsEveryRoomEntryOnlyToRequester() {
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);
        int clientA = (int) 3416484842L;
        int clientB = 12345;
        String stateA = "{\"user\":{\"name\":\"A\"}}";
        String stateB = "{\"user\":{\"name\":\"B\"}}";

        service.handleFrame(DOC_ID, awarenessFrame(clientA, 1, stateA), a);
        service.handleFrame(DOC_ID, awarenessFrame(clientB, 2, stateB), b);
        service.handleFrame(DOC_ID, awarenessFrame(clientA, 99, "relayed"), b);
        a.sent.clear();
        b.sent.clear();

        service.handleFrame(DOC_ID, queryFrame(), b);

        assertTrue(a.sent.isEmpty());
        assertEquals(1, b.sent.size());
        List<AwarenessWire> entries = decodeAwareness(b.sent.get(0));
        assertEquals(2, entries.size());
        assertTrue(entries.contains(new AwarenessWire(clientA, 1, stateA)));
        assertTrue(entries.contains(new AwarenessWire(clientB, 2, stateB)));
    }

    @Test
    void joinSendsStep1ThenRoomAwarenessSnapshotOnlyToNewConnection() {
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);
        int clientA = (int) 3416484842L;
        int clientB = 12345;
        String stateA = "{\"user\":{\"name\":\"A\"}}";
        String stateB = "{\"user\":{\"name\":\"B\"}}";
        service.handleFrame(DOC_ID, awarenessFrame(clientA, 3, stateA), a);
        service.handleFrame(DOC_ID, awarenessFrame(clientB, 4, stateB), b);
        a.sent.clear();
        b.sent.clear();

        FakeSession newcomer = new FakeSession("newcomer");
        registry.register(DOC_ID, newcomer);
        service.onClientJoin(DOC_ID, newcomer);

        assertEquals(2, newcomer.sent.size());
        ByteBuffer step1 = ByteBuffer.wrap(newcomer.sent.get(0));
        assertEquals(0, Lib0Codec.readVarUint(step1));
        assertEquals(0, Lib0Codec.readVarUint(step1));
        assertArrayEquals(new byte[]{0}, Lib0Codec.readVarUint8Array(step1));
        List<AwarenessWire> snapshot = decodeAwareness(newcomer.sent.get(1));
        assertEquals(2, snapshot.size());
        assertTrue(snapshot.contains(new AwarenessWire(clientA, 3, stateA)));
        assertTrue(snapshot.contains(new AwarenessWire(clientB, 4, stateB)));
        assertTrue(a.sent.isEmpty());
        assertTrue(b.sent.isEmpty());
    }

    @Test
    void closingSessionBroadcastsNullStateWithNextClockAndDropsRecord() {
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);
        int clientId = (int) 3416484842L;
        service.handleFrame(DOC_ID, awarenessFrame(clientId, 7, "{\"user\":{\"name\":\"A\"}}"), a);
        b.sent.clear();

        assertTrue(registry.unregister(DOC_ID, a));
        service.onClientLeft(DOC_ID, a);

        assertEquals(1, b.sent.size());
        assertEquals(List.of(new AwarenessWire(clientId, 8, "null")), decodeAwareness(b.sent.get(0)));

        b.sent.clear();
        service.handleFrame(DOC_ID, queryFrame(), b);
        assertEquals(1, b.sent.size());
        assertTrue(decodeAwareness(b.sent.get(0)).isEmpty());
    }

    @Test
    void malformedAwarenessFrameIsDroppedWithoutAffectingDocument() {
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);
        byte[] malformed = {1, 5, 1};

        assertDoesNotThrow(() -> service.handleFrame(DOC_ID, malformed, a));

        assertTrue(b.sent.isEmpty());
        assertTrue(a.sent.isEmpty());
        assertTrue(store.readUpdates(DOC_ID).isEmpty());
    }

    @Test
    void syncUpdatePathStillPersistsAndForwards() {
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);
        byte[] update = {1, 2, 3};
        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(frame, 0);
        Lib0Codec.writeVarUint(frame, 2);
        Lib0Codec.writeVarUint8Array(frame, update);

        service.handleFrame(DOC_ID, frame.toByteArray(), a);

        assertEquals(1, store.readUpdates(DOC_ID).size());
        assertArrayEquals(update, store.readUpdates(DOC_ID).get(0));
        assertEquals(1, b.sent.size());
        ByteBuffer in = ByteBuffer.wrap(b.sent.get(0));
        assertEquals(0, Lib0Codec.readVarUint(in));
        assertEquals(2, Lib0Codec.readVarUint(in));
        assertArrayEquals(update, Lib0Codec.readVarUint8Array(in));
    }

    @Test
    void emptyClientStep2IsIgnoredWithoutPersistingOrForwarding() {
        FakeSession a = new FakeSession("a");
        FakeSession b = new FakeSession("b");
        registry.register(DOC_ID, a);
        registry.register(DOC_ID, b);

        service.handleFrame(DOC_ID, syncFrame(1, new byte[]{0, 0}), a);

        assertTrue(store.readUpdates(DOC_ID).isEmpty());
        assertTrue(b.sent.isEmpty());
    }

    @Test
    void step1ReplyCarriesSnapshotInStep2ThenReplaysOnlyUpdatesAfterSnapshot() {
        byte[] snapshot = {9, 8, 7};
        byte[] delta1 = {1, 1};
        byte[] delta2 = {2, 2};
        store.saveSnapshot(DOC_ID, snapshot, store.readState(DOC_ID).version());
        store.appendUpdate(DOC_ID, delta1);
        store.appendUpdate(DOC_ID, delta2);
        FakeSession client = new FakeSession("client");

        service.handleFrame(DOC_ID, step1Frame(), client);

        assertEquals(3, client.sent.size());
        assertSyncFrame(client.sent.get(0), 1, snapshot);
        assertSyncFrame(client.sent.get(1), 2, delta1);
        assertSyncFrame(client.sent.get(2), 2, delta2);
    }

    @Test
    void step1ReplyWithoutSnapshotUsesEmptyStep2Payload() {
        byte[] delta = {3, 4};
        store.appendUpdate(DOC_ID, delta);
        FakeSession client = new FakeSession("client");

        service.handleFrame(DOC_ID, step1Frame(), client);

        assertEquals(2, client.sent.size());
        assertSyncFrame(client.sent.get(0), 1, new byte[]{0, 0});
        assertSyncFrame(client.sent.get(1), 2, delta);
    }

    private static byte[] step1Frame() {
        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(frame, 0);
        Lib0Codec.writeVarUint(frame, 0);
        Lib0Codec.writeVarUint8Array(frame, new byte[]{0});
        return frame.toByteArray();
    }

    private static byte[] syncFrame(int subtype, byte[] update) {
        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(frame, 0);
        Lib0Codec.writeVarUint(frame, subtype);
        Lib0Codec.writeVarUint8Array(frame, update);
        return frame.toByteArray();
    }

    private static void assertSyncFrame(byte[] frame, int expectedSubtype, byte[] expectedUpdate) {
        ByteBuffer in = ByteBuffer.wrap(frame);
        assertEquals(0, Lib0Codec.readVarUint(in));
        assertEquals(expectedSubtype, Lib0Codec.readVarUint(in));
        assertArrayEquals(expectedUpdate, Lib0Codec.readVarUint8Array(in));
    }

    private static byte[] awarenessFrame(int clientId, int clock, String stateJson) {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(body, 1);
        Lib0Codec.writeVarUint(body, clientId);
        Lib0Codec.writeVarUint(body, clock);
        Lib0Codec.writeVarString(body, stateJson);

        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(frame, 1);
        Lib0Codec.writeVarUint8Array(frame, body.toByteArray());
        return frame.toByteArray();
    }

    private static byte[] queryFrame() {
        ByteArrayOutputStream frame = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(frame, 3);
        return frame.toByteArray();
    }

    private static List<AwarenessWire> decodeAwareness(byte[] frame) {
        ByteBuffer in = ByteBuffer.wrap(frame);
        assertEquals(1, Lib0Codec.readVarUint(in));
        ByteBuffer body = ByteBuffer.wrap(Lib0Codec.readVarUint8Array(in));
        int count = Lib0Codec.readVarUint(body);
        List<AwarenessWire> entries = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            entries.add(new AwarenessWire(
                    Lib0Codec.readVarUint(body),
                    Lib0Codec.readVarUint(body),
                    Lib0Codec.readVarString(body)));
        }
        return entries;
    }

    private record AwarenessWire(int clientId, int clock, String stateJson) {
    }

    private static final class FakeSession implements WebSocketSession {

        private final String id;
        private final Map<String, Object> attributes = new HashMap<>();
        private final List<byte[]> sent = new ArrayList<>();
        private boolean open = true;

        private FakeSession(String id) {
            this.id = id;
        }

        @Override
        public String getId() {
            return id;
        }

        @Override
        public URI getUri() {
            return URI.create("ws://localhost/collab/" + DOC_ID);
        }

        @Override
        public HttpHeaders getHandshakeHeaders() {
            return new HttpHeaders();
        }

        @Override
        public Map<String, Object> getAttributes() {
            return attributes;
        }

        @Override
        public Principal getPrincipal() {
            return null;
        }

        @Override
        public InetSocketAddress getLocalAddress() {
            return null;
        }

        @Override
        public InetSocketAddress getRemoteAddress() {
            return null;
        }

        @Override
        public String getAcceptedProtocol() {
            return null;
        }

        @Override
        public void setTextMessageSizeLimit(int textMessageSizeLimit) {
        }

        @Override
        public int getTextMessageSizeLimit() {
            return 0;
        }

        @Override
        public void setBinaryMessageSizeLimit(int binaryMessageSizeLimit) {
        }

        @Override
        public int getBinaryMessageSizeLimit() {
            return 0;
        }

        @Override
        public List<WebSocketExtension> getExtensions() {
            return List.of();
        }

        @Override
        public void sendMessage(WebSocketMessage<?> message) throws IOException {
            if (message instanceof BinaryMessage binary) {
                ByteBuffer payload = binary.getPayload();
                byte[] bytes = new byte[payload.remaining()];
                payload.get(bytes);
                sent.add(bytes);
            }
        }

        @Override
        public boolean isOpen() {
            return open;
        }

        @Override
        public void close() throws IOException {
            open = false;
        }

        @Override
        public void close(CloseStatus status) throws IOException {
            open = false;
        }
    }
}
