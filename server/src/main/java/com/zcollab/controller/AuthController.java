package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.LoginRequest;
import com.zcollab.dto.PasswordRequest;
import com.zcollab.dto.RegisterRequest;
import com.zcollab.vo.LoggedInUser;
import com.zcollab.vo.RegisteredUser;
import com.zcollab.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ApiResponse<RegisteredUser> register(@RequestBody @Valid RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<LoggedInUser> login(@RequestBody @Valid LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Boolean> logout() {
        authService.logout();
        return ApiResponse.ok(true);
    }

    @PostMapping("/password")
    public ApiResponse<Boolean> changePassword(@RequestBody @Valid PasswordRequest request) {
        authService.changePassword(request);
        return ApiResponse.ok(true);
    }
}
