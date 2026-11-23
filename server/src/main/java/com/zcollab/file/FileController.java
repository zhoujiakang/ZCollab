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

/** 上传只要求登录，不绑定工作区：换工作区后仍可引用旧图片。 */
@RestController
@RequestMapping("/api/file")
@SaCheckLogin
public class FileController {

    private static final long MAX_SIZE = 10L * 1024 * 1024;

    private final FileStorageService storageService;

    public FileController(FileStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping("/upload")
    public ApiResponse<UploadResponse> upload(
            @RequestParam(name = "file", required = false) MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请选择要上传的图片");
        }
        if (file.getSize() > MAX_SIZE) {
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
        return ApiResponse.ok(new UploadResponse(stored.url(), stored.size(), stored.contentType()));
    }

    public record UploadResponse(String url, long size, String contentType) {
    }
}
