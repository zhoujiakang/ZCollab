package com.zcollab.vo.workspace;

import java.time.OffsetDateTime;

/** 匿名预览的最小响应：只有工作区名、邀请人名、成员数和过期时间。 */
public record PublicInviteResponse(String workspaceName, String inviterName, int memberCount,
                                   OffsetDateTime expiresAt) {
}
