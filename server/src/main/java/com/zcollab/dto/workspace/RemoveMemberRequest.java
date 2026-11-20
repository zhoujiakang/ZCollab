package com.zcollab.dto.workspace;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RemoveMemberRequest {

    @NotNull(message = "用户 id 不能为空")
    private Long userId;
}
