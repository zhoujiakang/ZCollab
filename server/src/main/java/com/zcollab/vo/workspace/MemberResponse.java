package com.zcollab.vo.workspace;

import java.time.OffsetDateTime;

public record MemberResponse(Long id, String username, String name, String role, OffsetDateTime joinedAt) {
}
