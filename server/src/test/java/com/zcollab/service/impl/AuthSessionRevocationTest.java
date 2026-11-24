package com.zcollab.service.impl;

import cn.dev33.satoken.SaManager;
import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.MybatisMapperBuilderAssistant;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.zcollab.dto.auth.PasswordRequest;
import com.zcollab.entity.User;
import com.zcollab.mapper.UserMapper;
import com.zcollab.service.LoginTokenRevoked;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class AuthSessionRevocationTest {
    private static final long USER_ID = 424242424242L;
    final List<Object> events = new ArrayList<>();
    final List<String> tokens = new ArrayList<>();
    boolean previousShare;

    @BeforeEach
    void setup() {
        SaTokenContextMockUtil.setMockContext();
        previousShare = SaManager.getConfig().getIsShare();
        SaManager.getConfig().setIsShare(false);
    }

    @AfterEach
    void cleanup() {
        for (String token : tokens) StpUtil.logoutByTokenValue(token);
        SaManager.getConfig().setIsShare(previousShare);
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void logoutInvalidatesTokenAndPublishesItsDisconnectEvent() {
        String token = login();
        new AuthServiceImpl(null, new BCryptPasswordEncoder(), events::add).logout();
        assertNull(StpUtil.getLoginIdByToken(token));
        assertEquals(List.of(new LoginTokenRevoked(token)), events);
    }

    @Test
    void passwordChangeRevokesOtherLoginButKeepsCurrentLogin() {
        String oldToken = login();
        String currentToken = login();
        assertNotEquals(oldToken, currentToken);
        TableInfoHelper.initTableInfo(new MybatisMapperBuilderAssistant(new MybatisConfiguration(), ""), User.class);
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        User user = new User(); user.setId(USER_ID); user.setPassword(encoder.encode("old-password"));
        UserMapper mapper = (UserMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{UserMapper.class}, (proxy, method, args) -> switch (method.getName()) {
                    case "selectById" -> user;
                    case "update" -> 1;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
        PasswordRequest request = new PasswordRequest();
        request.setOldPassword("old-password"); request.setNewPassword("new-password");
        new AuthServiceImpl(mapper, encoder, events::add).changePassword(request);
        assertNull(StpUtil.getLoginIdByToken(oldToken));
        assertEquals(Long.toString(USER_ID), StpUtil.getLoginIdByToken(currentToken).toString());
        assertEquals(List.of(new LoginTokenRevoked(oldToken)), events);
    }

    private String login() {
        StpUtil.login(USER_ID);
        String token = StpUtil.getTokenValue();
        tokens.add(token);
        return token;
    }
}
