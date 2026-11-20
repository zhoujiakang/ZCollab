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
    public byte[] readSnapshot(long docId) {
        byte[] snapshot = snapshots.get(docId);
        return snapshot == null ? null : snapshot.clone();
    }

    @Override
    public List<byte[]> readUpdates(long docId) {
        List<byte[]> stored = updates.get(docId);
        if (stored == null) {
            return List.of();
        }
        return stored.stream().map(byte[]::clone).toList();
    }

    @Override
    public void appendUpdate(long docId, byte[] update) {
        Objects.requireNonNull(update, "update");
        updates.computeIfAbsent(docId, ignored -> new CopyOnWriteArrayList<>()).add(update.clone());
    }

    @Override
    public void saveSnapshot(long docId, byte[] snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        snapshots.put(docId, snapshot.clone());
    }
}
