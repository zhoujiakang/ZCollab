package com.zcollab.dto.doc;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CompactDocRequest {

    @NotNull(message = "文档 id 不能为空")
    private Long id;

    @NotNull(message = "快照不能为空")
    private String snapshot;

    @NotBlank(message = "请先获取待收缩的文档状态")
    private String version;
}
