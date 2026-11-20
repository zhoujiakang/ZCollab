package com.zcollab.service;

import com.zcollab.dto.auth.LoginRequest;
import com.zcollab.dto.auth.PasswordRequest;
import com.zcollab.dto.auth.RegisterRequest;
import com.zcollab.vo.auth.LoginResponse;
import com.zcollab.vo.auth.RegisterResponse;

public interface AuthService {

    RegisterResponse register(RegisterRequest request);

    LoginResponse login(LoginRequest request);

    void logout();

    void changePassword(PasswordRequest request);
}
