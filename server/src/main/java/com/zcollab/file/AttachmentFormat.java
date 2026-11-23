package com.zcollab.file;

import java.util.Locale;

/** 附件白名单：声明类型（Content-Type / 扩展名）与真实文件头共用同一份定义。 */
public enum AttachmentFormat {

    PDF("application/pdf", "pdf"),
    ZIP("application/zip", "zip"),
    DOC("application/msword", "doc"),
    DOCX("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
    XLS("application/vnd.ms-excel", "xls"),
    XLSX("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"),
    PPT("application/vnd.ms-powerpoint", "ppt"),
    PPTX("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"),
    TXT("text/plain", "txt"),
    MD("text/markdown", "md");

    private static final byte[] PDF_MAGIC = {'%', 'P', 'D', 'F'};
    private static final byte[] ZIP_MAGIC = {'P', 'K', 3, 4};
    private static final byte[] ZIP_EMPTY_MAGIC = {'P', 'K', 5, 6};
    private static final byte[] ZIP_SPANNED_MAGIC = {'P', 'K', 7, 8};
    private static final byte[] OLE_MAGIC = {
            (byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0,
            (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1,
    };
    private static final byte[] PE_MAGIC = {'M', 'Z'};
    private static final byte[] ELF_MAGIC = {0x7F, 'E', 'L', 'F'};

    private final String contentType;
    private final String extension;

    AttachmentFormat(String contentType, String extension) {
        this.contentType = contentType;
        this.extension = extension;
    }

    public String contentType() {
        return contentType;
    }

    public String extension() {
        return extension;
    }

    public boolean ooxml() {
        return this == DOCX || this == XLSX || this == PPTX;
    }

    public boolean legacyOffice() {
        return this == DOC || this == XLS || this == PPT;
    }

    public static AttachmentFormat fromContentType(String contentType) {
        if (contentType == null) return null;
        String normalized = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "application/pdf" -> PDF;
            case "application/zip", "application/x-zip-compressed", "application/zip-compressed" -> ZIP;
            case "application/msword" -> DOC;
            case "application/vnd.openxmlformats-officedocument.wordprocessingml.document" -> DOCX;
            case "application/vnd.ms-excel" -> XLS;
            case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" -> XLSX;
            case "application/vnd.ms-powerpoint" -> PPT;
            case "application/vnd.openxmlformats-officedocument.presentationml.presentation" -> PPTX;
            case "text/plain" -> TXT;
            case "text/markdown", "text/x-markdown", "application/x-markdown" -> MD;
            default -> null;
        };
    }

    public static AttachmentFormat fromExtension(String originalName) {
        if (originalName == null) return null;
        int separator = Math.max(originalName.lastIndexOf('/'), originalName.lastIndexOf('\\'));
        String name = originalName.substring(separator + 1).toLowerCase(Locale.ROOT);
        int dot = name.lastIndexOf('.');
        if (dot < 0) return null;
        return switch (name.substring(dot + 1)) {
            case "pdf" -> PDF;
            case "zip" -> ZIP;
            case "doc" -> DOC;
            case "docx" -> DOCX;
            case "xls" -> XLS;
            case "xlsx" -> XLSX;
            case "ppt" -> PPT;
            case "pptx" -> PPTX;
            case "txt" -> TXT;
            case "md" -> MD;
            default -> null;
        };
    }

    public static boolean isZip(byte[] header) {
        return startsWith(header, ZIP_MAGIC)
                || startsWith(header, ZIP_EMPTY_MAGIC)
                || startsWith(header, ZIP_SPANNED_MAGIC);
    }

    /**
     * 魔数能判定的以魔数为准；ZIP 容器里的 OOXML 由 StorageService 进一步探测，
     * OLE2 与纯文本无法只凭头部区分具体格式，沿用声明类型但拒绝可执行文件头。
     */
    public static AttachmentFormat detect(String contentType, String originalName, byte[] header) {
        if (header == null) return null;
        if (startsWith(header, PE_MAGIC) || startsWith(header, ELF_MAGIC)) return null;

        AttachmentFormat declared = fromContentType(contentType);
        if (declared == null) declared = fromExtension(originalName);
        if (declared == null) return null;

        if (startsWith(header, PDF_MAGIC)) return declared == PDF ? PDF : null;
        if (isZip(header)) return declared == ZIP || declared.ooxml() ? declared : null;
        if (startsWith(header, OLE_MAGIC)) return declared.legacyOffice() ? declared : null;
        if (declared == TXT || declared == MD) {
            for (byte b : header) {
                if (b == 0) return null;
            }
            return declared;
        }
        return null;
    }

    private static boolean startsWith(byte[] header, byte[] magic) {
        if (header == null || header.length < magic.length) return false;
        for (int i = 0; i < magic.length; i += 1) {
            if (header[i] != magic[i]) return false;
        }
        return true;
    }
}
