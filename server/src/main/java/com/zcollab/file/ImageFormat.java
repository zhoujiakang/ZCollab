package com.zcollab.file;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/** 允许的四种图片格式：Content-Type 白名单和真实文件头共用同一份定义。 */
public enum ImageFormat {

    PNG("image/png", "png"),
    JPEG("image/jpeg", "jpg"),
    GIF("image/gif", "gif"),
    WEBP("image/webp", "webp");

    private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G'};
    private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] GIF_MAGIC = {'G', 'I', 'F', '8'};
    private static final byte[] RIFF = {'R', 'I', 'F', 'F'};

    private final String contentType;
    private final String extension;

    ImageFormat(String contentType, String extension) {
        this.contentType = contentType;
        this.extension = extension;
    }

    public String contentType() {
        return contentType;
    }

    public String extension() {
        return extension;
    }

    public static ImageFormat fromContentType(String contentType) {
        if (contentType == null) return null;
        String normalized = contentType.split(";", 2)[0].trim().toLowerCase();
        for (ImageFormat format : values()) {
            if (format.contentType.equals(normalized)) return format;
        }
        return null;
    }

    /** header 至少取前 12 个字节；WEBP 需要比对 8~11 字节的 RIFF 容器标识。 */
    public static ImageFormat fromHeader(byte[] header) {
        if (header == null) return null;
        if (startsWith(header, PNG_MAGIC)) return PNG;
        if (startsWith(header, JPEG_MAGIC)) return JPEG;
        if (startsWith(header, GIF_MAGIC)) return GIF;
        if (header.length >= 12
                && startsWith(header, RIFF)
                && new String(header, 8, 4, StandardCharsets.US_ASCII).equals("WEBP")) {
            return WEBP;
        }
        return null;
    }

    private static boolean startsWith(byte[] header, byte[] magic) {
        if (header.length < magic.length) return false;
        return Arrays.equals(Arrays.copyOf(header, magic.length), magic);
    }
}
