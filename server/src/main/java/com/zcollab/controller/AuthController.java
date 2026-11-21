package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.auth.LoginRequest;
import com.zcollab.dto.auth.PasswordRequest;
import com.zcollab.dto.auth.RegisterRequest;
import com.zcollab.vo.auth.LoginResponse;
import com.zcollab.vo.auth.RegisterResponse;
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
    public ApiResponse<RegisterResponse> register(@RequestBody @Valid RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@RequestBody @Valid LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        authService.logout();
        return ApiResponse.ok();
    }

    @PostMapping("/password")
    public ApiResponse<Void> changePassword(@RequestBody @Valid PasswordRequest request) {
        authService.changePassword(request);
        return ApiResponse.ok();
    }
}
