package com.zcollab.dto.workspace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RenameWorkspaceRequest {

    @NotBlank(message = "工作区名称不能为空")
    @Size(max = 100, message = "工作区名称不能超过 100 位")
    private String name;
}
