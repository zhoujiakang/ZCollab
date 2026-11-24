package com.zcollab.context;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.WorkspaceMemberMapper;
import com.zcollab.service.impl.WorkspaceMemberServiceImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.lang.reflect.Proxy;
import static org.junit.jupiter.api.Assertions.*;

class WorkspaceContextTest {
    final WorkspaceContext context = new WorkspaceContext();

    @BeforeEach
    void login() {
        SaTokenContextMockUtil.setMockContext();
        StpUtil.login(42L);
        context.setActiveWorkspaceId(7L);
    }

    @AfterEach
    void cleanup() {
        RequestContextHolder.resetRequestAttributes();
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void explicitWorkspaceRemainsPinnedAcrossAnotherTabsSwitch() {
        context.setActiveWorkspaceId(8L);
        requestWorkspace("7");
        assertEquals(7L, context.getActiveWorkspaceId());
        requestWorkspace("8");
        assertEquals(8L, context.getActiveWorkspaceId());
        RequestContextHolder.resetRequestAttributes();
        assertEquals(8L, context.getActiveWorkspaceId());
    }

    @Test
    void invalidExplicitIdsAreRejectedRatherThanFallingBack() {
        for (String value : new String[]{"", "abc", "-1", "0", "999999999999999999999999"}) {
            requestWorkspace(value);
            BusinessException error = assertThrows(BusinessException.class, context::getActiveWorkspaceId);
            assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        }
    }

    @Test
    void unauthorizedExplicitWorkspaceCannotFallBackToAnotherMembership() {
        requestWorkspace("99");
        WorkspaceMemberMapper mapper = (WorkspaceMemberMapper) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{WorkspaceMemberMapper.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("selectOne")) return null;
                    throw new AssertionError("Must not fall back or write: " + method.getName());
                });
        var service = new WorkspaceMemberServiceImpl(mapper, null, context, event -> {});
        BusinessException error = assertThrows(BusinessException.class, service::requireCurrentMembership);
        assertEquals(ErrorCode.FORBIDDEN, error.getErrorCode());
        RequestContextHolder.resetRequestAttributes();
        assertEquals(7L, context.getActiveWorkspaceId());
    }

    private void requestWorkspace(String workspaceId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(WorkspaceContext.WORKSPACE_HEADER, workspaceId);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }
}
