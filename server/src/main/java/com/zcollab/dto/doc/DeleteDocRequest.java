package com.zcollab.dto.doc;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DeleteDocRequest {

    @NotNull(message = "文档 id 不能为空")
    private Long id;
}
