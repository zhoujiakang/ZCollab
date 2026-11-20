package com.zcollab.core.protocol;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

/**
 * lib0 (y-protocols) binary primitives, implemented with JDK-only types.
 */
public final class Lib0Codec {

    private static final int CONTINUATION_BIT = 0x80;
    private static final int DATA_MASK = 0x7f;

    private Lib0Codec() {
    }

    /**
     * Write an unsigned 32-bit integer, 7 bits per byte, high bit set when more bytes follow.
     * Negative int values are interpreted as their unsigned 32-bit representation, matching
     * readVarUint and Yjs client ids.
     */
    public static void writeVarUint(ByteArrayOutputStream out, int value) {
        Objects.requireNonNull(out, "out");
        long remaining = Integer.toUnsignedLong(value);
        while ((remaining & ~DATA_MASK) != 0) {
            out.write((int) ((remaining & DATA_MASK) | CONTINUATION_BIT));
            remaining >>>= 7;
        }
        out.write((int) remaining);
    }

    /** Read a varUint, advancing the buffer cursor. Accepts the unsigned 32-bit range. */
    public static int readVarUint(ByteBuffer in) {
        Objects.requireNonNull(in, "in");
        long result = 0;
        for (int i = 0; i < 5; i++) {
            if (!in.hasRemaining()) {
                throw new IllegalArgumentException("truncated varUint");
            }
            int current = in.get() & 0xff;
            result |= ((long) (current & DATA_MASK)) << (7 * i);
            if ((current & CONTINUATION_BIT) == 0) {
                if (result > 0xffff_ffffL) {
                    throw new IllegalArgumentException("varUint out of range: " + result);
                }
                return (int) result;
            }
        }
        throw new IllegalArgumentException("varUint is longer than 5 bytes");
    }

    /** Write a varUint byte length followed by the UTF-8 bytes of the string. */
    public static void writeVarString(ByteArrayOutputStream out, String value) {
        Objects.requireNonNull(value, "value");
        writeVarUint8Array(out, value.getBytes(StandardCharsets.UTF_8));
    }

    /** Read a varString, advancing the buffer cursor. */
    public static String readVarString(ByteBuffer in) {
        return new String(readVarUint8Array(in), StandardCharsets.UTF_8);
    }

    /** Write a varUint byte length followed by the raw bytes. */
    public static void writeVarUint8Array(ByteArrayOutputStream out, byte[] bytes) {
        Objects.requireNonNull(bytes, "bytes");
        writeVarUint(out, bytes.length);
        out.write(bytes, 0, bytes.length);
    }

    /** Read a length-prefixed byte array, advancing the buffer cursor. */
    public static byte[] readVarUint8Array(ByteBuffer in) {
        int length = readVarUint(in);
        if (length < 0 || length > in.remaining()) {
            throw new IllegalArgumentException("invalid varUint8Array length: " + length);
        }
        byte[] result = new byte[length];
        in.get(result);
        return result;
    }
}
