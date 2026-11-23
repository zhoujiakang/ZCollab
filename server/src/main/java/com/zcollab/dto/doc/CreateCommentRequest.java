package com.zcollab.dto.doc;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateCommentRequest {

    @NotNull(message = "文档 id 不能为空")
    private Long docId;

    private Long parentId;

    @NotBlank(message = "评论内容不能为空")
    @Size(min = 1, max = 2000, message = "评论内容需要在 1 到 2000 个字符之间")
    private String body;

    @Size(max = 500, message = "引用原文不能超过 500 个字符")
    private String quote;

    private Integer anchorFrom;

    private Integer anchorTo;
}
