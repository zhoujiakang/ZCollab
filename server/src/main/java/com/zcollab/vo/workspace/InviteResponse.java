package com.zcollab.vo.workspace;

import java.time.OffsetDateTime;

public record InviteResponse(Long id, String token, String path, Long createdBy, String creatorName,
                             OffsetDateTime expiresAt, OffsetDateTime createdAt) {
}
