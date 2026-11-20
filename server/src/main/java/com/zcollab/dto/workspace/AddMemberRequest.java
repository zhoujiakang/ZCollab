package com.zcollab.dto.workspace;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AddMemberRequest {

    @NotBlank(message = "账号不能为空")
    @Size(max = 255, message = "账号不能超过 255 位")
    private String username;
}
