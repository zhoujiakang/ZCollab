package com.zcollab.core.store;

import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/** A consistent persisted state and an opaque token used for optimistic compaction. */
public record DocState(byte[] snapshot, List<byte[]> updates, String version) {
    public DocState(byte[] snapshot, List<byte[]> updates) {
        this(snapshot, updates, fingerprint(snapshot, updates));
    }

    private static String fingerprint(byte[] snapshot, List<byte[]> updates) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            hashPart(digest, snapshot);
            for (byte[] update : updates) hashPart(digest, update);
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void hashPart(MessageDigest digest, byte[] bytes) {
        digest.update(ByteBuffer.allocate(4).putInt(bytes == null ? -1 : bytes.length).array());
        if (bytes != null) digest.update(bytes);
    }
}
