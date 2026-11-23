package com.zcollab.dto.workspace;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RevokeInviteRequest {

    @NotNull(message = "邀请链接 id 不能为空")
    private Long id;
}
