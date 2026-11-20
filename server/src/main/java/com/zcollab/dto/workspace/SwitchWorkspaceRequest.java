package com.zcollab.dto.workspace;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SwitchWorkspaceRequest {

    @NotNull(message = "工作区 id 不能为空")
    private Long id;
}
