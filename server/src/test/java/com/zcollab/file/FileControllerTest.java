package com.zcollab.file;

import com.zcollab.exception.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

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
    private static final byte[] PDF = "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n".getBytes(StandardCharsets.US_ASCII);

    @Test
    void storesWithRandomNameUnderYearMonth() throws IOException {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        FileController.UploadResponse result = controller.upload(
                new MockMultipartFile("file", "原始名字.png", "image/png", PNG)).data();

        assertTrue(result.url().matches("/files/\\d{4}/\\d{2}/[0-9a-f]{32}\\.png"), result.url());
        assertEquals("原始名字.png", result.name());
        assertEquals("image", result.kind());
        assertEquals(PNG.length, result.size());
        assertEquals("image/png", result.contentType());
        assertTrue(Files.isRegularFile(tempDir.resolve(result.url().substring("/files/".length()))));
    }

    @Test
    void storesAttachmentWithCleanNameAndEncodedUrl() throws IOException {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        FileController.UploadResponse result = controller.upload(new MockMultipartFile(
                "file", "季度 报告.pdf", "application/pdf", PDF)).data();

        assertEquals("attachment", result.kind());
        assertEquals("季度 报告.pdf", result.name());
        assertEquals("application/pdf", result.contentType());
        assertEquals(PDF.length, result.size());
        assertTrue(result.url().matches("/files/\\d{4}/\\d{2}/[0-9a-f]{8}-.+\\.pdf"), result.url());
        assertTrue(result.url().contains("%20"), result.url());
        assertTrue(result.url().contains("%E5%AD%A3%E5%BA%A6"), result.url());
        assertFalse(result.url().contains(" "), result.url());
        String relative = URLDecoder.decode(result.url().substring("/files/".length()), StandardCharsets.UTF_8);
        assertTrue(Files.isRegularFile(tempDir.resolve(relative)), relative);
    }

    @Test
    void stripsPathAndControlCharactersFromAttachmentName() throws IOException {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        FileController.UploadResponse result = controller.upload(new MockMultipartFile(
                "file", "..\\evil\\报告\u0001.txt", "text/plain",
                "hello".getBytes(StandardCharsets.UTF_8))).data();

        assertEquals("报告.txt", result.name());
        assertFalse(result.url().contains(".."), result.url());
        assertFalse(result.url().contains("\\"), result.url());
    }

    @Test
    void usesProbedExtensionForOoxmlAttachment() throws IOException {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));
        byte[] docx = zipWithEntry("word/document.xml");

        FileController.UploadResponse result = controller.upload(new MockMultipartFile(
                "file", "表格.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx)).data();

        assertTrue(result.name().endsWith(".docx"), result.name());
        assertEquals("attachment", result.kind());
        assertTrue(Files.isRegularFile(tempDir.resolve(
                URLDecoder.decode(result.url().substring("/files/".length()), StandardCharsets.UTF_8))));
    }

    @Test
    void storesZipAttachment() throws IOException {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));
        byte[] zip = zipWithEntry("readme.txt");

        FileController.UploadResponse result = controller.upload(new MockMultipartFile(
                "file", "归档.zip", "application/zip", zip)).data();

        assertEquals("归档.zip", result.name());
        assertEquals("attachment", result.kind());
    }

    @Test
    void rejectsDangerousExtensionsAndContentTypes() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException svg = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "x.svg", "image/svg+xml", PNG)));
        assertTrue(svg.getMessage().contains("不允许"), svg.getMessage());

        BusinessException html = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "x.html", "text/html",
                        "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8))));
        assertTrue(html.getMessage().contains("不允许"), html.getMessage());

        BusinessException disguised = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "x.pdf", "image/svg+xml", PDF)));
        assertTrue(disguised.getMessage().contains("不允许"), disguised.getMessage());
    }

    @Test
    void rejectsAttachmentMismatchAndUnsupportedType() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException mismatch = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "fake.pdf", "application/pdf",
                        "not a pdf".getBytes(StandardCharsets.UTF_8))));
        assertTrue(mismatch.getMessage().contains("仅支持"), mismatch.getMessage());

        BusinessException unsupported = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "x.exe", "application/octet-stream", PDF)));
        assertTrue(unsupported.getMessage().contains("不允许"), unsupported.getMessage());
    }

    @Test
    void rejectsOversizedImageAndAttachment() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException image = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "big.png", "image/png", new byte[10 * 1024 * 1024 + 1])));
        assertTrue(image.getMessage().contains("10MB"), image.getMessage());

        BusinessException attachment = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "big.pdf", "application/pdf", new byte[20 * 1024 * 1024 + 1])));
        assertTrue(attachment.getMessage().contains("20MB"), attachment.getMessage());

        BusinessException twentyFiveMb = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "huge.zip", "application/zip", new byte[25 * 1024 * 1024])));
        assertTrue(twentyFiveMb.getMessage().contains("20MB"), twentyFiveMb.getMessage());
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
    void rejectsContentTypeMismatchForImage() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException error = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "wrong.gif", "image/gif", PNG)));

        assertTrue(error.getMessage().contains("不是图片"), error.getMessage());
    }

    @Test
    void rejectsUnsupportedImageContentType() {
        FileController controller = new FileController(new FileStorageService(tempDir.toString()));

        BusinessException error = assertThrows(BusinessException.class, () -> controller.upload(
                new MockMultipartFile("file", "x.bmp", "image/bmp", PNG)));

        assertTrue(error.getMessage().contains("仅支持"), error.getMessage());
    }

    private static byte[] zipWithEntry(String entryName) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry(entryName));
            zip.write("content".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return bytes.toByteArray();
    }
}
