package com.zcollab.file;

import com.zcollab.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileControllerTest {

    @TempDir
    Path tempDir;

    private static final byte[] PNG = {
            (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A,
            0, 0, 0, 0, 0, 0, 0, 0,
    };

    @Test
    void storesWithRandomNameUnderYearMonth() throws IOException {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        FileController.UploadResponse result = controller.upload(
                new MockMultipartFile("file", "原始名字.png", "image/png", PNG)).data();

        assertTrue(result.url().matches("/files/\\d{4}/\\d{2}/[0-9a-f]{32}\\.png"), result.url());
        assertFalse(result.url().contains("原始名字"));
        assertEquals(PNG.length, result.size());
        assertEquals("image/png", result.contentType());
        assertTrue(Files.isRegularFile(tempDir.resolve(result.url().substring("/files/".length()))));
    }

    @Test
    void rejectsTextRenamedToPng() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException error = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "evil.png", "image/png",
                        "this is not an image".getBytes(StandardCharsets.UTF_8))));

        assertTrue(error.getMessage().contains("不是图片"), error.getMessage());
    }

    @Test
    void rejectsContentTypeMismatch() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException error = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "wrong.gif", "image/gif", PNG)));

        assertTrue(error.getMessage().contains("不是图片"), error.getMessage());
    }

    @Test
    void rejectsOversizedFile() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException error = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "big.png", "image/png", new byte[10 * 1024 * 1024 + 1])));

        assertTrue(error.getMessage().contains("10MB"), error.getMessage());
    }

    @Test
    void rejectsUnsupportedContentType() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException error = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "x.svg", "image/svg+xml", PNG)));

        assertTrue(error.getMessage().contains("仅支持"), error.getMessage());
    }
}
