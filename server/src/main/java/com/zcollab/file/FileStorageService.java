package com.zcollab.file;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** 只负责目录、真实格式探测和落盘，不含参数校验与响应包装。 */
@Service
public class FileStorageService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();
    private static final int HEADER_BYTES = 12;
    private static final int PREFIX_BYTES = 4;
    private static final int NAME_MAX_LENGTH = 80;
    private static final int OOXML_ENTRIES_TO_SCAN = 100;
    private static final char[] HEX_DIGITS = "0123456789ABCDEF".toCharArray();

    private final Path root;

    public FileStorageService(@Value("${zcollab.upload-dir:./uploads}") String uploadDir) {
        this.root = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    public ImageFormat probe(MultipartFile file) throws IOException {
        return ImageFormat.fromHeader(readHeader(file));
    }

    /** 附件格式：先按魔数校验声明类型，OOXML 再看 ZIP 内的目录名确定具体扩展名。 */
    public AttachmentFormat probeAttachment(MultipartFile file) throws IOException {
        byte[] header = readHeader(file);
        AttachmentFormat format = AttachmentFormat.detect(
                file.getContentType(), file.getOriginalFilename(), header);
        if (format != null && format.ooxml() && AttachmentFormat.isZip(header)) {
            format = probeOoxml(file, format);
        }
        return format;
    }

    public StoredFile store(MultipartFile file, ImageFormat format) throws IOException {
        LocalDate today = LocalDate.now();
        Path directory = currentDirectory(today);
        String fileName = HEX.formatHex(randomBytes(16)) + "." + format.extension();
        write(file, directory.resolve(fileName));
        return new StoredFile(
                "/files/" + monthPath(today) + fileName,
                file.getSize(),
                format.contentType(),
                originalName(file));
    }

    public StoredFile storeAttachment(MultipartFile file, AttachmentFormat format) throws IOException {
        LocalDate today = LocalDate.now();
        Path directory = currentDirectory(today);
        String name = cleanName(originalName(file), format.extension());
        String fileName = HEX.formatHex(randomBytes(PREFIX_BYTES)) + "-" + name;
        write(file, directory.resolve(fileName));
        return new StoredFile(
                "/files/" + monthPath(today) + encodePathSegment(fileName),
                file.getSize(),
                format.contentType(),
                name);
    }

    private byte[] readHeader(MultipartFile file) throws IOException {
        try (InputStream input = file.getInputStream()) {
            return input.readNBytes(HEADER_BYTES);
        }
    }

    private AttachmentFormat probeOoxml(MultipartFile file, AttachmentFormat declared) {
        try (InputStream input = file.getInputStream();
             ZipInputStream zip = new ZipInputStream(input, StandardCharsets.UTF_8)) {
            ZipEntry entry;
            int scanned = 0;
            while ((entry = zip.getNextEntry()) != null && scanned < OOXML_ENTRIES_TO_SCAN) {
                scanned += 1;
                String name = entry.getName();
                if (name.startsWith("word/")) return AttachmentFormat.DOCX;
                if (name.startsWith("xl/")) return AttachmentFormat.XLSX;
                if (name.startsWith("ppt/")) return AttachmentFormat.PPTX;
            }
            return declared;
        } catch (IOException e) {
            return declared;
        }
    }

    private Path currentDirectory(LocalDate today) throws IOException {
        Path directory = root.resolve(String.format("%04d", today.getYear()))
                .resolve(String.format("%02d", today.getMonthValue()));
        Files.createDirectories(directory);
        return directory;
    }

    private static String monthPath(LocalDate today) {
        return String.format("%04d", today.getYear()) + "/" + String.format("%02d", today.getMonthValue()) + "/";
    }

    private static void write(MultipartFile file, Path target) throws IOException {
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static byte[] randomBytes(int length) {
        byte[] bytes = new byte[length];
        RANDOM.nextBytes(bytes);
        return bytes;
    }

    private static String originalName(MultipartFile file) {
        String name = file.getOriginalFilename();
        return name == null || name.isBlank() ? "file" : name;
    }

    /** 去掉路径分隔符与控制字符，截到 80 字符内，扩展名一律换成探测结果。 */
    private static String cleanName(String original, String extension) {
        String normalized = original.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        if (slash >= 0) normalized = normalized.substring(slash + 1);

        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < normalized.length(); i += 1) {
            char c = normalized.charAt(i);
            if (Character.isISOControl(c) || c == '/' || c == '\\') continue;
            builder.append(c);
        }
        String name = builder.toString().trim();
        int dot = name.lastIndexOf('.');
        if (dot > 0) name = name.substring(0, dot);
        if (name.isEmpty() || ".".equals(name) || "..".equals(name)) name = "file";

        int maxBase = NAME_MAX_LENGTH - extension.length() - 1;
        if (name.length() > maxBase) name = name.substring(0, maxBase);
        return name + "." + extension;
    }

    /** 与浏览器 encodeURIComponent 一致：只保留未保留字符，其余按 UTF-8 百分号编码。 */
    private static String encodePathSegment(String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        StringBuilder encoded = new StringBuilder(bytes.length);
        for (byte b : bytes) {
            int value8 = b & 0xFF;
            if ((value8 >= 'A' && value8 <= 'Z') || (value8 >= 'a' && value8 <= 'z')
                    || (value8 >= '0' && value8 <= '9')
                    || value8 == '-' || value8 == '_' || value8 == '.' || value8 == '~') {
                encoded.append((char) value8);
            } else {
                encoded.append('%')
                        .append(HEX_DIGITS[value8 >> 4])
                        .append(HEX_DIGITS[value8 & 0x0F]);
            }
        }
        return encoded.toString();
    }

    public record StoredFile(String url, long size, String contentType, String name) {
    }
}
