package com.zcollab.core.store;

import java.util.List;

/** Persistence boundary for document snapshots and updates. No framework types. */
public interface DocStore {

    /** Return the latest snapshot bytes, or null when none exists. */
    byte[] readSnapshot(long docId);

    /** Return all updates recorded for the document, in append order. */
    List<byte[]> readUpdates(long docId);

    /** Append one update to the document log. */
    void appendUpdate(long docId, byte[] update);

    /** Implementations must read this state atomically with respect to append and compaction. */
    default DocState readState(long docId) {
        return new DocState(readSnapshot(docId), readUpdates(docId));
    }

    /** Replace the snapshot and remove covered updates only if the prepared state is unchanged. */
    boolean saveSnapshot(long docId, byte[] snapshot, String expectedVersion);
}
