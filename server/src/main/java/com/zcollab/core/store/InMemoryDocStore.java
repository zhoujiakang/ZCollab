package com.zcollab.core.store;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/** Temporary, in-memory DocStore for local checks. Data is lost on restart. */
public class InMemoryDocStore implements DocStore {

    private final ConcurrentHashMap<Long, byte[]> snapshots = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<Long, List<byte[]>> updates = new ConcurrentHashMap<>();

    @Override
    public synchronized byte[] readSnapshot(long docId) {
        byte[] snapshot = snapshots.get(docId);
        return snapshot == null ? null : snapshot.clone();
    }

    @Override
    public synchronized List<byte[]> readUpdates(long docId) {
        List<byte[]> stored = updates.get(docId);
        if (stored == null) {
            return List.of();
        }
        return stored.stream().map(byte[]::clone).toList();
    }

    @Override
    public synchronized void appendUpdate(long docId, byte[] update) {
        Objects.requireNonNull(update, "update");
        updates.computeIfAbsent(docId, ignored -> new CopyOnWriteArrayList<>()).add(update.clone());
    }

    @Override
    public synchronized DocState readState(long docId) {
        return DocStore.super.readState(docId);
    }

    @Override
    public synchronized boolean saveSnapshot(long docId, byte[] snapshot, String expectedVersion) {
        Objects.requireNonNull(snapshot, "snapshot");
        if (!readState(docId).version().equals(expectedVersion)) return false;
        snapshots.put(docId, snapshot.clone());
        updates.remove(docId);
        return true;
    }
}
