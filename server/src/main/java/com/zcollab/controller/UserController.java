package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.vo.CurrentUser;
import com.zcollab.service.AuthService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AuthService authService;

    public UserController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/me")
    public ApiResponse<CurrentUser> me() {
        return ApiResponse.ok(authService.me());
    }
}
