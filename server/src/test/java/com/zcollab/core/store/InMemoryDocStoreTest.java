package com.zcollab.core.store;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

class InMemoryDocStoreTest {

    @Test
    void storesSnapshotsAndUpdatesPerDocument() {
        InMemoryDocStore store = new InMemoryDocStore();
        byte[] first = "update-1".getBytes(StandardCharsets.UTF_8);
        byte[] second = "update-2".getBytes(StandardCharsets.UTF_8);
        byte[] snapshot = "snapshot".getBytes(StandardCharsets.UTF_8);

        assertNull(store.readSnapshot(7));
        assertEquals(List.of(), store.readUpdates(7));

        store.appendUpdate(7, first);
        store.appendUpdate(7, second);
        store.saveSnapshot(7, snapshot, store.readState(7).version());
        store.appendUpdate(8, first);

        assertEquals(0, store.readUpdates(7).size());
        assertArrayEquals(snapshot, store.readSnapshot(7));
        assertEquals(1, store.readUpdates(8).size());

        store.saveSnapshot(7, second, store.readState(7).version());
        assertArrayEquals(second, store.readSnapshot(7));
    }
}
