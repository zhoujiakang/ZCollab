package com.zcollab.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.MybatisMapperBuilderAssistant;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.zcollab.dto.user.UpdateProfileRequest;
import com.zcollab.entity.User;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.UserMapper;
import com.zcollab.service.WorkspaceService;
import com.zcollab.vo.user.CurrentUserResponse;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.time.OffsetDateTime;
import java.util.List;

class UserServiceImplTest {

    private static final long USER_ID = 42L;

    static {
        TableInfoHelper.initTableInfo(
                new MybatisMapperBuilderAssistant(new MybatisConfiguration(), ""), User.class);
    }

    @BeforeEach
    void setUp() {
        SaTokenContextMockUtil.setMockContext();
        StpUtil.login(USER_ID);
    }

    @AfterEach
    void tearDown() {
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void updateProfileTrimsNameClearsEmptyAvatarAndWritesUpdatedAt() {
        User stored = new User();
        stored.setId(USER_ID);
        stored.setUsername("alice");
        stored.setName("旧名字");
        stored.setAvatarUrl("/files/old.png");
        stored.setCreatedAt(OffsetDateTime.parse("2026-01-01T00:00:00Z"));
        stored.setUpdatedAt(stored.getCreatedAt());

        UserMapper users = proxy(UserMapper.class, (proxy, method, args) -> switch (method.getName()) {
            case "selectById" -> stored;
            case "update" -> {
                @SuppressWarnings("unchecked")
                LambdaUpdateWrapper<User> wrapper = (LambdaUpdateWrapper<User>) args[1];
                String setSql = wrapper.getSqlSet();
                assertTrue(setSql.contains("name"), setSql);
                assertTrue(setSql.contains("avatar_url"), setSql);
                assertTrue(setSql.contains("updated_at"), setSql);
                assertTrue(wrapper.getParamNameValuePairs().containsValue("新名字"));
                assertTrue(wrapper.getParamNameValuePairs().values().stream()
                        .anyMatch(OffsetDateTime.class::isInstance));
                stored.setName("新名字");
                stored.setAvatarUrl(null);
                stored.setUpdatedAt(OffsetDateTime.now());
                yield 1;
            }
            default -> null;
        });
        WorkspaceService workspaces = proxy(WorkspaceService.class, (proxy, method, args) -> switch (method.getName()) {
            case "myWorkspaces" -> List.<WorkspaceSummaryResponse>of();
            case "resolveActiveWorkspace" -> null;
            case "myWorkspacePage" -> null;
            default -> null;
        });
        UserServiceImpl service = new UserServiceImpl(users, workspaces);

        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setName("  新名字  ");
        request.setAvatarUrl("");

        CurrentUserResponse response = service.updateProfile(request);

        assertEquals("新名字", response.name());
        assertNull(response.avatarUrl());
        assertEquals(USER_ID, response.id());
    }

    @Test
    void updateProfileRejectsBlankNameAfterTrim() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setName("   ");

        BusinessException error = assertThrows(BusinessException.class,
                () -> new UserServiceImpl(existingUser(), emptyWorkspaces()).updateProfile(request));

        assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        assertEquals("昵称不能为空", error.getMessage());
    }

    @Test
    void updateProfileRejectsExternalAvatarUrl() {
        UserMapper users = existingUser();
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setName("小名");
        request.setAvatarUrl("javascript:alert(1)");

        BusinessException error = assertThrows(BusinessException.class,
                () -> new UserServiceImpl(users, emptyWorkspaces()).updateProfile(request));

        assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        assertEquals("头像地址不合法", error.getMessage());
    }

    @Test
    void updateProfileRejectsMissingUser() {
        UserMapper users = proxy(UserMapper.class, (proxy, method, args) -> null);
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setName("小名");

        BusinessException error = assertThrows(BusinessException.class,
                () -> new UserServiceImpl(users, emptyWorkspaces()).updateProfile(request));

        assertEquals(ErrorCode.UNAUTHORIZED, error.getErrorCode());
    }

    private static UserMapper existingUser() {
        User stored = new User();
        stored.setId(USER_ID);
        stored.setName("旧名字");
        return proxy(UserMapper.class, (proxy, method, args) -> {
            if ("selectById".equals(method.getName())) return stored;
            return null;
        });
    }

    private static WorkspaceService emptyWorkspaces() {
        return proxy(WorkspaceService.class, (proxy, method, args) -> null);
    }

    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
    }
}
