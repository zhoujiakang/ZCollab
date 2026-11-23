package com.zcollab.service.impl;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.MybatisMapperBuilderAssistant;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.zcollab.context.WorkspaceContext;
import com.zcollab.entity.Workspace;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.WorkspaceMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.workspace.WorkspaceInfoResponse;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkspaceServiceImplTest {

    private static final long USER_ID = 42L;
    private static final long WORKSPACE_ID = 7L;

    static {
        TableInfoHelper.initTableInfo(
                new MybatisMapperBuilderAssistant(new MybatisConfiguration(), ""), Workspace.class);
    }

    private String role;
    private List<LambdaUpdateWrapper<Workspace>> updates;

    @BeforeEach
    void setUp() {
        SaTokenContextMockUtil.setMockContext();
        StpUtil.login(USER_ID);
        role = "owner";
        updates = new ArrayList<>();
    }

    @AfterEach
    void tearDown() {
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void renameTrimsNameAndDoesNotWriteUpdatedAt() {
        WorkspaceServiceImpl service = service();

        WorkspaceInfoResponse info = service.rename("  新名字  ");

        assertEquals(WORKSPACE_ID, info.id());
        assertEquals("新名字", info.name());
        assertEquals(3, info.memberCount());
        assertEquals(1, updates.size());
        String sqlSet = updates.get(0).getSqlSet();
        assertTrue(sqlSet.contains("name"), sqlSet);
        assertFalse(sqlSet.contains("updated_at"), sqlSet);
        assertTrue(updates.get(0).getParamNameValuePairs().containsValue("新名字"));
    }

    @Test
    void renameRejectsMember() {
        role = "member";
        WorkspaceServiceImpl service = service();

        BusinessException error = assertThrows(BusinessException.class, () -> service.rename("新名字"));
        assertEquals(ErrorCode.FORBIDDEN, error.getErrorCode());
        assertTrue(updates.isEmpty());
    }

    @Test
    void renameRejectsBlankAfterTrim() {
        WorkspaceServiceImpl service = service();

        BusinessException error = assertThrows(BusinessException.class, () -> service.rename("   "));
        assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        assertTrue(updates.isEmpty());
    }

    private WorkspaceServiceImpl service() {
        Workspace stored = new Workspace();
        stored.setId(WORKSPACE_ID);
        stored.setName("旧名字");

        WorkspaceMapper mapper = proxy(WorkspaceMapper.class, (p, method, args) -> switch (method.getName()) {
            case "selectById" -> stored;
            case "update" -> {
                @SuppressWarnings("unchecked")
                LambdaUpdateWrapper<Workspace> wrapper = (LambdaUpdateWrapper<Workspace>) args[1];
                updates.add(wrapper);
                stored.setName((String) wrapper.getParamNameValuePairs().values().stream()
                        .filter(String.class::isInstance).findFirst().orElseThrow());
                yield 1;
            }
            default -> null;
        });
        WorkspaceMemberService members = proxy(WorkspaceMemberService.class, (p, method, args) ->
                switch (method.getName()) {
                    case "requireCurrentMembership" -> new WorkspaceMembership(WORKSPACE_ID, role);
                    case "countByWorkspace" -> 3;
                    default -> null;
                });
        return new WorkspaceServiceImpl(mapper, members, new WorkspaceContext());
    }

    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
    }
}
