package com.zcollab.service.impl;

import cn.dev33.satoken.SaManager;
import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.zcollab.dto.auth.LoginRequest;
import com.zcollab.dto.auth.PasswordRequest;
import com.zcollab.dto.auth.RegisterRequest;
import com.zcollab.entity.User;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.UserMapper;
import com.zcollab.service.AuthService;
import com.zcollab.vo.auth.LoginResponse;
import com.zcollab.vo.auth.RegisterResponse;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final BCryptPasswordEncoder passwordEncoder;

    public AuthServiceImpl(UserMapper userMapper, BCryptPasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public RegisterResponse register(RegisterRequest request) {
        if (userMapper.selectByUsername(request.getUsername()) != null) {
            throw new BusinessException(ErrorCode.USERNAME_TAKEN);
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setName(StringUtils.hasText(request.getName()) ? request.getName() : request.getUsername());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userMapper.insert(user);

        return new RegisterResponse(user.getId(), user.getUsername(), user.getName());
    }

    @Override
    public LoginResponse login(LoginRequest request) {
        User user = userMapper.selectByUsername(request.getUsername());
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }

        StpUtil.login(user.getId());

        return new LoginResponse(user.getId(), user.getUsername(), user.getName());
    }

    @Override
    public void logout() {
        StpUtil.logout();
    }

    @Override
    public void changePassword(PasswordRequest request) {
        long userId = StpUtil.getLoginIdAsLong();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new BusinessException(ErrorCode.INVALID_CREDENTIALS);
        }

        userMapper.update(null, new LambdaUpdateWrapper<User>()
                .set(User::getPassword, passwordEncoder.encode(request.getNewPassword()))
                .eq(User::getId, userId));

        String currentToken = StpUtil.getTokenValue();
        for (String token : StpUtil.getTokenValueListByLoginId(userId)) {
            if (!token.equals(currentToken)) {
                kickToken(token);
            }
        }
    }

    private void kickToken(String token) {
        StpUtil.logoutByTokenValue(token);
        SaManager.getSaTokenDao().delete(StpUtil.getStpLogic().splicingKeyTokenValue(token));
    }
}
