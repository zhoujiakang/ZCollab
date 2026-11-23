package com.zcollab.dto.doc;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ImportDocRequest {

    @NotBlank(message = "标题不能为空")
    @Size(max = 200, message = "标题长度不能超过 200 字符")
    private String title;

    private Long parentId;

    @NotBlank(message = "content 不能为空")
    private String content;

    private String contentText;
}
