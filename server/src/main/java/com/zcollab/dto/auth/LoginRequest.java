package com.zcollab.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {

    @NotBlank(message = "账号不能为空")
    @Size(min = 3, max = 32, message = "账号长度须为 3-32 位")
    @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "账号只允许字母、数字、下划线和连字符")
    private String username;

    @NotBlank(message = "密码不能为空")
    private String password;
}
