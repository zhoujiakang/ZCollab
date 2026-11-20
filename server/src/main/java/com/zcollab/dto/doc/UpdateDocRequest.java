package com.zcollab.dto.doc;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateDocRequest {

    @NotNull(message = "文档 id 不能为空")
    private Long id;

    @Size(max = 255, message = "标题不能超过 255 位")
    private String title;

    private String content;
}
