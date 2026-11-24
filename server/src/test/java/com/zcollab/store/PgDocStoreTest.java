package com.zcollab.store;

import com.zcollab.entity.DocUpdate;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.DocUpdateMapper;
import com.zcollab.vo.doc.DocSnapshotRow;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;

import static org.junit.jupiter.api.Assertions.*;

class PgDocStoreTest {
    @Test
    void lateSnapshotCannotDeleteNewlyCommittedEdits() {
        Harness h = new Harness();
        h.store.appendUpdate(42, new byte[]{1});
        var prepared = h.store.readState(42);
        h.store.appendUpdate(42, new byte[]{2});

        assertFalse(h.store.saveSnapshot(42, new byte[]{1}, prepared.version()));
        assertNull(h.snapshot);
        assertEquals(2, h.updates.size());
        assertEquals(0, h.deletions);
    }

    @Test
    void delayedCompactionCannotReplaceAnotherSnapshotAtSameSequence() {
        Harness h = new Harness();
        var oldState = h.store.readState(42);
        assertTrue(h.store.saveSnapshot(42, new byte[]{1}, oldState.version()));

        assertFalse(h.store.saveSnapshot(42, new byte[]{2}, oldState.version()));
        assertArrayEquals(new byte[]{1}, h.snapshot);
    }

    @Test
    void successfulCompactionPreservesSubsequentUpdatesAndSequence() {
        Harness h = new Harness();
        h.store.appendUpdate(42, new byte[]{1});
        h.store.appendUpdate(42, new byte[]{2});
        var prepared = h.store.readState(42);

        assertTrue(h.store.saveSnapshot(42, new byte[]{1, 2}, prepared.version()));
        assertEquals(2, h.snapshotSeq);
        assertTrue(h.updates.isEmpty());
        h.store.appendUpdate(42, new byte[]{3});
        var restored = h.store.readState(42);
        assertEquals(List.of(3L), new ArrayList<>(h.updates.keySet()));
        assertArrayEquals(new byte[]{1, 2}, restored.snapshot());
        assertArrayEquals(new byte[]{3}, restored.updates().getFirst());
    }

    @Test
    void allMutationsAndConsistentReadsStartWithDocumentLock() {
        Harness h = new Harness();
        h.store.appendUpdate(42, new byte[]{1});
        assertEquals("lockDocument", h.calls.getFirst());
        h.calls.clear();
        var state = h.store.readState(42);
        assertEquals("lockDocument", h.calls.getFirst());
        h.calls.clear();
        h.store.saveSnapshot(42, new byte[]{1}, state.version());
        assertEquals("lockDocument", h.calls.getFirst());
    }

    @Test
    void legacyVersionlessSnapshotDoesNotChangeStoredState() {
        Harness h = new Harness();
        h.store.appendUpdate(42, new byte[]{1});
        assertFalse(h.store.saveSnapshot(42, new byte[]{2}, null));
        assertNull(h.snapshot);
        assertEquals(1, h.updates.size());
    }

    private static class Harness {
        final TreeMap<Long, byte[]> updates = new TreeMap<>();
        final List<String> calls = new ArrayList<>();
        byte[] snapshot;
        long snapshotSeq;
        int deletions;
        final PgDocStore store;

        Harness() {
            DocMapper docs = (DocMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{DocMapper.class}, (proxy, method, args) -> {
                        calls.add(method.getName());
                        return switch (method.getName()) {
                            case "lockDocument" -> 42L;
                            case "selectSnapshot" -> {
                                var row = new DocSnapshotRow();
                                row.setSnapshot(snapshot);
                                row.setSnapshotSeq(snapshotSeq);
                                yield row;
                            }
                            case "updateSnapshot" -> {
                                snapshot = (byte[]) args[1]; snapshotSeq = (long) args[2]; yield 1;
                            }
                            default -> throw new UnsupportedOperationException(method.getName());
                        };
                    });
            DocUpdateMapper mapper = (DocUpdateMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{DocUpdateMapper.class}, (proxy, method, args) -> {
                        calls.add(method.getName());
                        return switch (method.getName()) {
                            case "selectNextSeq" -> Math.max(snapshotSeq, updates.isEmpty() ? 0 : updates.lastKey()) + 1;
                            case "insert" -> {
                                DocUpdate update = (DocUpdate) args[0];
                                updates.put(update.getSeq(), update.getPayload()); yield 1;
                            }
                            case "selectByDocIdOrderBySeq" -> updates.tailMap((long) args[1], false)
                                    .entrySet().stream().map(entry -> {
                                        DocUpdate row = new DocUpdate(); row.setSeq(entry.getKey());
                                        row.setPayload(entry.getValue()); return row;
                                    }).toList();
                            case "deleteByDocIdAndSeqLessThanEqual" -> {
                                deletions++; int before = updates.size();
                                updates.headMap((long) args[1], true).clear(); yield before - updates.size();
                            }
                            default -> throw new UnsupportedOperationException(method.getName());
                        };
                    });
            store = new PgDocStore(mapper, docs);
        }
    }
}
