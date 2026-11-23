package com.zcollab.dto.doc;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DeleteCommentRequest {

    @NotNull(message = "评论 id 不能为空")
    private Long id;
}
