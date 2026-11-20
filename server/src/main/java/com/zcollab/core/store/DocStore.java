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

    /** Overwrite (or create) the document snapshot. */
    void saveSnapshot(long docId, byte[] snapshot);
}
