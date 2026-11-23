package com.zcollab.vo.doc;

import java.time.OffsetDateTime;
import java.util.List;

public record DocCommentResponse(
        Long id,
        Long parentId,
        String quote,
        String body,
        CommentAuthorResponse author,
        OffsetDateTime createdAt,
        OffsetDateTime resolvedAt,
        boolean canDelete,
        List<DocCommentResponse> replies
) {
}
