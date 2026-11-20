package com.zcollab.core.protocol;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.Random;
import org.junit.jupiter.api.Test;

class Lib0CodecTest {

    @Test
    void varUintRoundTripAndEncodedLength() {
        int[] values = {0, 127, 128, 16384, 1000000};
        int[] expectedLengths = {1, 1, 2, 3, 3};

        for (int i = 0; i < values.length; i++) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Lib0Codec.writeVarUint(out, values[i]);
            byte[] encoded = out.toByteArray();

            assertEquals(expectedLengths[i], encoded.length, "value " + values[i]);
            assertEquals(values[i], Lib0Codec.readVarUint(ByteBuffer.wrap(encoded)), "value " + values[i]);
        }
    }

    @Test
    void varUintRoundTripForUnsigned32BitClientId() {
        int clientId = (int) 3416484842L;

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(out, clientId);
        byte[] encoded = out.toByteArray();

        assertEquals(clientId, Lib0Codec.readVarUint(ByteBuffer.wrap(encoded)));
        assertEquals("3416484842", Integer.toUnsignedString(clientId));
    }

    @Test
    void varStringRoundTripForChineseAndEmptyString() {
        for (String value : List.of("协同编辑：你好，世界！🎉", "")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Lib0Codec.writeVarString(out, value);
            byte[] encoded = out.toByteArray();

            assertEquals(value, Lib0Codec.readVarString(ByteBuffer.wrap(encoded)));
        }
    }

    @Test
    void varUint8ArrayRoundTripFor256RandomBytes() {
        byte[] source = new byte[256];
        new Random(20261120).nextBytes(source);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint8Array(out, source);

        assertArrayEquals(source, Lib0Codec.readVarUint8Array(ByteBuffer.wrap(out.toByteArray())));
    }

    @Test
    void decoderCursorAdvancesAcrossConsecutiveValues() {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Lib0Codec.writeVarUint(out, 128);
        Lib0Codec.writeVarString(out, "ok");
        Lib0Codec.writeVarUint8Array(out, new byte[] {1, 2, 3});

        ByteBuffer in = ByteBuffer.wrap(out.toByteArray());
        assertEquals(128, Lib0Codec.readVarUint(in));
        assertEquals("ok", Lib0Codec.readVarString(in));
        assertArrayEquals(new byte[] {1, 2, 3}, Lib0Codec.readVarUint8Array(in));
        assertEquals(0, in.remaining());
    }
}
