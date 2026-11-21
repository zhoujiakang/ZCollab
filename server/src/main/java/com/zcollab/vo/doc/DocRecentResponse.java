package com.zcollab.vo.doc;

import java.time.OffsetDateTime;

public record DocRecentResponse(Long id, String title, OffsetDateTime visitedAt) {
}
