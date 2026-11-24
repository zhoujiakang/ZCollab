package com.zcollab.ws;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.context.WorkspaceContext;
import com.zcollab.entity.Doc;
import com.zcollab.mapper.DocMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import static com.zcollab.ws.CollabHandshakeInterceptor.*;
import static org.junit.jupiter.api.Assertions.*;

class CollabHandshakeInterceptorTest {
    String token;

    @BeforeEach
    void login() {
        SaTokenContextMockUtil.setMockContext();
        StpUtil.login(42L);
        token = StpUtil.getTokenValue();
        new WorkspaceContext().setActiveWorkspaceId(8L);
    }

    @AfterEach
    void cleanup() {
        StpUtil.logout();
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void documentWorkspaceIsUsedRegardlessOfAnotherTabsActiveWorkspace() {
        Map<String, Object> attributes = handshake(true);
        assertEquals(CLOSE_OK, attributes.get(ATTR_CLOSE_CODE));
        assertEquals(7L, attributes.get(ATTR_WORKSPACE_ID));
        assertEquals(token, attributes.get(ATTR_TOKEN));
        assertEquals(8L, new WorkspaceContext().getActiveWorkspaceId());
    }

    @Test
    void documentInNonMemberWorkspaceIsStillRejected() {
        assertEquals(CLOSE_NOT_FOUND, handshake(false).get(ATTR_CLOSE_CODE));
    }

    private Map<String, Object> handshake(boolean isMember) {
        Doc doc = new Doc(); doc.setId(42L); doc.setWorkspaceId(7L);
        DocMapper mapper = (DocMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{DocMapper.class}, (proxy, method, args) -> doc);
        WorkspaceMemberService members = (WorkspaceMemberService) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{WorkspaceMemberService.class},
                (proxy, method, args) -> {
                    assertEquals("findMembership", method.getName());
                    assertEquals(7L, args[0]);
                    return isMember ? new WorkspaceMembership(7L, "member") : null;
                });
        var request = new MockHttpServletRequest("GET", "/collab/42");
        request.addHeader("Cookie", "authToken=" + token);
        Map<String, Object> attributes = new HashMap<>();
        new CollabHandshakeInterceptor(mapper, members, "authToken").beforeHandshake(
                new ServletServerHttpRequest(request), new ServletServerHttpResponse(new MockHttpServletResponse()),
                null, attributes);
        return attributes;
    }
}
