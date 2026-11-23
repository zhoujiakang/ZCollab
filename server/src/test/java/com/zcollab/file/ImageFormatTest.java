package com.zcollab.file;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class ImageFormatTest {

    @Test
    void detectsAllowedMagicBytes() {
        assertEquals(ImageFormat.PNG, ImageFormat.fromHeader(header(0x89, 'P', 'N', 'G', 0x0D)));
        assertEquals(ImageFormat.JPEG, ImageFormat.fromHeader(header(0xFF, 0xD8, 0xFF, 0xE0)));
        assertEquals(ImageFormat.GIF, ImageFormat.fromHeader(header('G', 'I', 'F', '8', '9', 'a')));

        byte[] webp = new byte[12];
        byte[] riff = "RIFF".getBytes(StandardCharsets.US_ASCII);
        byte[] size = {0, 0, 0, 0};
        byte[] tag = "WEBP".getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(riff, 0, webp, 0, 4);
        System.arraycopy(size, 0, webp, 4, 4);
        System.arraycopy(tag, 0, webp, 8, 4);
        assertEquals(ImageFormat.WEBP, ImageFormat.fromHeader(webp));
    }

    @Test
    void rejectsTextAndShortOrFakeWebpHeaders() {
        assertNull(ImageFormat.fromHeader("just plain text".getBytes(StandardCharsets.UTF_8)));
        assertNull(ImageFormat.fromHeader(header('R', 'I', 'F', 'F')));

        byte[] notWebp = new byte[12];
        System.arraycopy("RIFF".getBytes(StandardCharsets.US_ASCII), 0, notWebp, 0, 4);
        System.arraycopy("JUNK".getBytes(StandardCharsets.US_ASCII), 0, notWebp, 8, 4);
        assertNull(ImageFormat.fromHeader(notWebp));
    }

    @Test
    void contentTypeWhitelistIgnoresParametersAndCase() {
        assertEquals(ImageFormat.PNG, ImageFormat.fromContentType("image/png; charset=binary"));
        assertEquals(ImageFormat.JPEG, ImageFormat.fromContentType("IMAGE/JPEG"));
        assertNull(ImageFormat.fromContentType("image/svg+xml"));
        assertNull(ImageFormat.fromContentType(null));
    }

    private static byte[] header(int... values) {
        byte[] bytes = new byte[values.length];
        for (int i = 0; i < values.length; i += 1) {
            bytes[i] = (byte) values[i];
        }
        return bytes;
    }
}
