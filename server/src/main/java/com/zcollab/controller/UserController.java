package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.common.PageRequest;
import com.zcollab.service.UserService;
import com.zcollab.vo.user.CurrentUserResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/me")
    public ApiResponse<CurrentUserResponse> me(@RequestBody(required = false) @Valid PageRequest request) {
        return ApiResponse.ok(userService.me(request == null ? new PageRequest() : request));
    }
}
