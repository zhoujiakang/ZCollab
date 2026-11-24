package com.zcollab.file;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.util.UriUtils;

import java.nio.charset.StandardCharsets;

/** Keep image resources inline; all supported attachment formats are downloads, including old URLs. */
public class AttachmentDownloadInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String path = UriUtils.decode(request.getRequestURI(), StandardCharsets.UTF_8);
        String filename = path.substring(path.lastIndexOf('/') + 1);
        if (AttachmentFormat.fromExtension(filename) != null) {
            // Stored attachments have an eight-digit random prefix; use their clean display name.
            String downloadName = filename.replaceFirst("^[0-9a-f]{8}-", "")
                    .replaceAll("[\\p{Cntrl}\\\\]", "_");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                    .filename(downloadName, StandardCharsets.UTF_8).build().toString());
        }
        return true;
    }
}
