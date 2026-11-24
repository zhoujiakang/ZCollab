package com.zcollab.config;

import com.zcollab.file.AttachmentFormat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.MapPropertySource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AttachmentDownloadTest {
    @TempDir Path root;
    AnnotationConfigWebApplicationContext context;
    MockMvc mvc;
    final byte[] body = "中文附件原始内容，不转换编码。".getBytes(StandardCharsets.UTF_8);

    @Configuration
    @EnableWebMvc
    static class Mvc {}

    @BeforeEach
    void setup() throws Exception {
        Files.createDirectories(root.resolve("2026/11"));
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                "zcollab.upload-dir", root.toString())));
        context.register(Mvc.class, WebMvcConfig.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @AfterEach
    void close() { if (context != null) context.close(); }

    @Test
    void everySupportedAttachmentDownloadsWithItsChineseFilenameAndOriginalBytes() throws Exception {
        for (AttachmentFormat format : AttachmentFormat.values()) {
            String display = "季度 报告." + format.extension();
            String filename = "a1b2c3d4-" + display;
            Files.write(root.resolve("2026/11").resolve(filename), body);
            var response = mvc.perform(get("/files/2026/11/{filename}", filename))
                    .andExpect(status().isOk()).andExpect(content().bytes(body))
                    .andReturn().getResponse();
            var disposition = ContentDisposition.parse(response.getHeader(HttpHeaders.CONTENT_DISPOSITION));
            assertEquals("attachment", disposition.getType(), format.name());
            assertEquals(display, disposition.getFilename(), format.name());
        }
    }

    @Test
    void oldAttachmentUrlsSupportHeadAndRangeDownloads() throws Exception {
        String filename = "deadbeef-existing.pdf";
        Files.write(root.resolve("2026/11").resolve(filename), body);
        mvc.perform(head("/files/2026/11/{filename}", filename))
                .andExpect(status().isOk()).andExpect(header().exists(HttpHeaders.CONTENT_DISPOSITION))
                .andExpect(content().bytes(new byte[0]));
        mvc.perform(get("/files/2026/11/{filename}", filename).header(HttpHeaders.RANGE, "bytes=0-3"))
                .andExpect(status().isPartialContent()).andExpect(header().exists(HttpHeaders.CONTENT_DISPOSITION))
                .andExpect(content().bytes(Arrays.copyOf(body, 4)));
    }

    @Test
    void inlineImagesKeepWorking() throws Exception {
        for (String extension : new String[]{"png", "jpg", "jpeg", "gif", "webp"}) {
            String filename = "0123456789abcdef0123456789abcdef." + extension;
            Files.write(root.resolve("2026/11").resolve(filename), body);
            mvc.perform(get("/files/2026/11/{filename}", filename))
                    .andExpect(status().isOk()).andExpect(header().doesNotExist(HttpHeaders.CONTENT_DISPOSITION))
                    .andExpect(content().bytes(body));
        }
    }
}
