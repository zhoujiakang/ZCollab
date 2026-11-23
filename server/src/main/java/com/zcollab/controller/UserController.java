package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.common.PageRequest;
import com.zcollab.dto.user.UpdateProfileRequest;
import com.zcollab.service.UserService;
import com.zcollab.vo.user.CurrentUserResponse;
import cn.dev33.satoken.annotation.SaCheckLogin;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@SaCheckLogin
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/me")
    public ApiResponse<CurrentUserResponse> me(@RequestBody(required = false) @Valid PageRequest request) {
        return ApiResponse.ok(userService.me(request == null ? new PageRequest() : request));
    }

    @PostMapping("/profile")
    public ApiResponse<CurrentUserResponse> updateProfile(@RequestBody @Valid UpdateProfileRequest request) {
        return ApiResponse.ok(userService.updateProfile(request));
    }
}
