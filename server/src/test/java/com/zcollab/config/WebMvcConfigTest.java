package com.zcollab.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebMvcConfigTest {

    @TempDir
    Path tempDir;

    @Test
    void addsTrailingSlashWhenDirectoryDoesNotExist() {
        String missing = tempDir.resolve("not-created").toString();

        String location = WebMvcConfig.resourceLocation(missing);

        assertTrue(location.endsWith("/"), location);
        assertTrue(location.contains("not-created/"), location);
    }

    @Test
    void doesNotDuplicateTrailingSlash() {
        String location = WebMvcConfig.resourceLocation(tempDir.toString());

        assertTrue(location.endsWith("/"), location);
        assertFalse(location.endsWith("//"), location);
    }
}
