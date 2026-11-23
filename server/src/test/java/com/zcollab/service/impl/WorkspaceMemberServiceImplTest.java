package com.zcollab.service.impl;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.MybatisMapperBuilderAssistant;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.zcollab.context.WorkspaceContext;
import com.zcollab.entity.WorkspaceMember;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.UserMapper;
import com.zcollab.mapper.WorkspaceMemberMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkspaceMemberServiceImplTest {

    private static final long USER_ID = 42L;
    private static final long WORKSPACE_ID = 7L;
    private static final long TARGET_ID = 9L;

    static {
        TableInfoHelper.initTableInfo(
                new MybatisMapperBuilderAssistant(new MybatisConfiguration(), ""), WorkspaceMember.class);
    }

    private List<LambdaUpdateWrapper<WorkspaceMember>> updates;

    @BeforeEach
    void setUp() {
        SaTokenContextMockUtil.setMockContext();
        StpUtil.login(USER_ID);
        updates = new ArrayList<>();
    }

    @AfterEach
    void tearDown() {
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void transferOwnerUpdatesBothRoles() {
        WorkspaceMemberServiceImpl service = service();

        service.transferOwner(TARGET_ID);

        assertEquals(2, updates.size());
        assertEquals("member", onlyString(updates.get(0)));
        assertEquals("owner", onlyString(updates.get(1)));
        assertTrue(updates.get(0).getParamNameValuePairs().containsValue(WORKSPACE_ID));
        assertTrue(updates.get(0).getParamNameValuePairs().containsValue(USER_ID));
        assertTrue(updates.get(1).getParamNameValuePairs().containsValue(2L));
    }

    @Test
    void transferOwnerRejectsSelf() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service().transferOwner(USER_ID));
        assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        assertTrue(updates.isEmpty());
    }

    @Test
    void transferOwnerRejectsUserOutsideWorkspace() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service().transferOwner(999L));
        assertEquals(ErrorCode.NOT_FOUND, error.getErrorCode());
        assertTrue(updates.isEmpty());
    }

    @Test
    void transferOwnerRejectsExistingOwner() {
        BusinessException error = assertThrows(BusinessException.class,
                () -> service().transferOwner(8L));
        assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        assertTrue(updates.isEmpty());
    }

    private WorkspaceMemberServiceImpl service() {
        WorkspaceMemberMapper mapper = proxy(WorkspaceMemberMapper.class, (p, method, args) -> {
            if ("selectOne".equals(method.getName())) {
                @SuppressWarnings("unchecked")
                LambdaQueryWrapper<WorkspaceMember> wrapper = (LambdaQueryWrapper<WorkspaceMember>) args[0];
                wrapper.getSqlSegment();
                for (Object value : wrapper.getParamNameValuePairs().values()) {
                    if (Long.valueOf(USER_ID).equals(value)) return member(1L, USER_ID, "owner");
                    if (Long.valueOf(TARGET_ID).equals(value)) return member(2L, TARGET_ID, "member");
                    if (Long.valueOf(8L).equals(value)) return member(3L, 8L, "owner");
                }
                return null;
            }
            if ("update".equals(method.getName())) {
                @SuppressWarnings("unchecked")
                LambdaUpdateWrapper<WorkspaceMember> wrapper = (LambdaUpdateWrapper<WorkspaceMember>) args[1];
                updates.add(wrapper);
                return 1;
            }
            return null;
        });
        UserMapper users = proxy(UserMapper.class, (p, method, args) -> null);
        WorkspaceContext context = new WorkspaceContext();
        context.setActiveWorkspaceId(WORKSPACE_ID);
        return new WorkspaceMemberServiceImpl(mapper, users, context);
    }

    private static WorkspaceMember member(Long id, Long userId, String role) {
        WorkspaceMember member = new WorkspaceMember();
        member.setId(id);
        member.setWorkspaceId(WORKSPACE_ID);
        member.setUserId(userId);
        member.setRole(role);
        return member;
    }

    private static String onlyString(LambdaUpdateWrapper<WorkspaceMember> wrapper) {
        String sqlSet = wrapper.getSqlSet();
        wrapper.getSqlSegment();
        assertTrue(sqlSet.contains("role"), sqlSet);
        return (String) wrapper.getParamNameValuePairs().values().stream()
                .filter(String.class::isInstance).findFirst().orElseThrow();
    }

    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
    }
}
