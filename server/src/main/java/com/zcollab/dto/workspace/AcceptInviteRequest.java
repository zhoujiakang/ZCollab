package com.zcollab.dto.workspace;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AcceptInviteRequest {

    @NotBlank(message = "邀请 token 不能为空")
    private String token;
}
