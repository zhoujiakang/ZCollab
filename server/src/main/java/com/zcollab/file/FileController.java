package com.zcollab.file;

import cn.dev33.satoken.annotation.SaCheckLogin;
import com.zcollab.common.ApiResponse;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

/** 上传只要求登录，不绑定工作区：换工作区后仍可引用旧文件。 */
@RestController
@RequestMapping("/api/file")
@SaCheckLogin
public class FileController {

    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024;
    private static final long MAX_ATTACHMENT_SIZE = 20L * 1024 * 1024;

    /** /files/** 公开可读，这些扩展名落盘后等同于往站内放可执行内容。 */
    private static final Set<String> FORBIDDEN_EXTENSIONS =
            Set.of("html", "htm", "svg", "js", "mjs", "xml", "exe", "sh");
    private static final Set<String> FORBIDDEN_CONTENT_TYPES = Set.of(
            "text/html", "application/xhtml+xml", "image/svg+xml",
            "application/javascript", "text/javascript", "application/ecmascript",
            "application/xml", "text/xml", "application/x-msdownload",
            "application/x-msdos-program", "application/x-sh", "text/x-sh");

    private final FileStorageService storageService;

    public FileController(FileStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping("/upload")
    public ApiResponse<UploadResponse> upload(
            @RequestParam(name = "file", required = false) MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择要上传的文件");
        }

        rejectDangerous(file.getOriginalFilename(), file.getContentType());
        if (isImage(file.getContentType())) {
            return uploadImage(file);
        }
        return uploadAttachment(file);
    }

    private ApiResponse<UploadResponse> uploadImage(MultipartFile file) throws IOException {
        if (file.getSize() > MAX_IMAGE_SIZE) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "图片大小不能超过 10MB");
        }

        ImageFormat claimed = ImageFormat.fromContentType(file.getContentType());
        if (claimed == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "仅支持 PNG、JPEG、GIF、WEBP 图片");
        }

        ImageFormat actual = storageService.probe(file);
        if (actual == null || actual != claimed) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "文件内容不是图片（仅支持 PNG、JPEG、GIF、WEBP）");
        }

        FileStorageService.StoredFile stored = storageService.store(file, actual);
        return ApiResponse.ok(response(stored, "image"));
    }

    private ApiResponse<UploadResponse> uploadAttachment(MultipartFile file) throws IOException {
        if (file.getSize() > MAX_ATTACHMENT_SIZE) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "附件大小不能超过 20MB");
        }

        AttachmentFormat format = storageService.probeAttachment(file);
        if (format == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "仅支持 PDF、ZIP、DOC、DOCX、XLS、XLSX、PPT、PPTX、TXT、MD 附件");
        }

        FileStorageService.StoredFile stored = storageService.storeAttachment(file, format);
        return ApiResponse.ok(response(stored, "attachment"));
    }

    private static UploadResponse response(FileStorageService.StoredFile stored, String kind) {
        return new UploadResponse(stored.url(), stored.name(), stored.size(), stored.contentType(), kind);
    }

    private static boolean isImage(String contentType) {
        return contentType != null
                && contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT).startsWith("image/");
    }

    private static void rejectDangerous(String originalName, String contentType) {
        String extension = extensionOf(originalName);
        if (extension != null && FORBIDDEN_EXTENSIONS.contains(extension)) {
            throw dangerous();
        }
        if (contentType == null) return;
        String normalized = contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        if (FORBIDDEN_CONTENT_TYPES.contains(normalized)) {
            throw dangerous();
        }
    }

    private static String extensionOf(String originalName) {
        if (originalName == null) return null;
        int separator = Math.max(originalName.lastIndexOf('/'), originalName.lastIndexOf('\\'));
        String name = originalName.substring(separator + 1).toLowerCase(Locale.ROOT);
        int dot = name.lastIndexOf('.');
        return dot < 0 ? null : name.substring(dot + 1);
    }

    private static BusinessException dangerous() {
        return new BusinessException(ErrorCode.BAD_REQUEST,
                "出于安全考虑，不允许上传 HTML、SVG、脚本或可执行文件（html、htm、svg、js、mjs、xml、exe、sh）");
    }

    public record UploadResponse(String url, String name, long size, String contentType, String kind) {
    }
}
