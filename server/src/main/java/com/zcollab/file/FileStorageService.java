package com.zcollab.file;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.HexFormat;

/** 只负责目录、真实格式探测和落盘，不含参数校验与响应包装。 */
@Service
public class FileStorageService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int HEADER_BYTES = 12;

    private final Path root;

    public FileStorageService(@Value("${zcollab.upload-dir:./uploads}") String uploadDir) {
        this.root = Paths.get(uploadDir).toAbsolutePath().normalize();
    }

    public ImageFormat probe(MultipartFile file) throws IOException {
        try (InputStream input = file.getInputStream()) {
            return ImageFormat.fromHeader(input.readNBytes(HEADER_BYTES));
        }
    }

    public StoredFile store(MultipartFile file, ImageFormat format) throws IOException {
        LocalDate today = LocalDate.now();
        String year = String.format("%04d", today.getYear());
        String month = String.format("%02d", today.getMonthValue());

        Path directory = root.resolve(year).resolve(month);
        Files.createDirectories(directory);

        byte[] random = new byte[16];
        RANDOM.nextBytes(random);
        String fileName = HexFormat.of().formatHex(random) + "." + format.extension();
        Path target = directory.resolve(fileName);
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }

        return new StoredFile("/files/" + year + "/" + month + "/" + fileName,
                file.getSize(), format.contentType());
    }

    public record StoredFile(String url, long size, String contentType) {
    }
}
