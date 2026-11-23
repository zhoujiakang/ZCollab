package com.zcollab.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateProfileRequest {

    @NotBlank(message = "昵称不能为空")
    @Size(max = 50, message = "昵称长度不能超过 50 位")
    private String name;

    @Size(max = 512, message = "头像地址长度不能超过 512 位")
    private String avatarUrl;
}
