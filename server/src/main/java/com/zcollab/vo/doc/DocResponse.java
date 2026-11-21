package com.zcollab.vo.doc;

import java.time.OffsetDateTime;

public record DocResponse(Long id, Long parentDocId, String title, String content, String contentText,
                          OffsetDateTime updatedAt) {
}
