package com.zcollab.controller;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.exception.GlobalExceptionHandler;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.service.WorkspaceService;
import com.zcollab.vo.workspace.WorkspaceInfoResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Proxy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class WorkspaceControllerTest {

    private static final long USER_ID = 42L;
    private static final long WORKSPACE_ID = 7L;

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
    void renameRejectsNameLongerThan100() throws Exception {
        MockMvc mvc = mvc(new WorkspaceInfoResponse(WORKSPACE_ID, "x", "owner", 1), new BusinessException[0]);

        String tooLong = "a".repeat(101);
        mvc.perform(post("/api/workspace/rename")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + tooLong + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void renameRejectsBlankAfterTrim() throws Exception {
        MockMvc mvc = mvc(null, new BusinessException[]{new BusinessException(ErrorCode.BAD_REQUEST)});

        mvc.perform(post("/api/workspace/rename")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"   \"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void renameRejectsMember() throws Exception {
        MockMvc mvc = mvc(null, new BusinessException[]{new BusinessException(ErrorCode.FORBIDDEN)});

        mvc.perform(post("/api/workspace/rename")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"新名字\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void transferRequiresLogin() throws Exception {
        SaTokenContextMockUtil.clearContext();
        SaTokenContextMockUtil.setMockContext();
        WorkspaceMemberService members = proxy(WorkspaceMemberService.class, (p, method, args) -> null);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new WorkspaceMemberController(members))
                .addInterceptors(new SaInterceptor())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(post("/api/workspace/members/transfer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\":9}"))
                .andExpect(status().isUnauthorized());
    }

    private static MockMvc mvc(WorkspaceInfoResponse info, BusinessException[] error) {
        WorkspaceService service = proxy(WorkspaceService.class, (p, method, args) -> {
            if (error.length > 0) throw error[0];
            return info;
        });
        return MockMvcBuilders.standaloneSetup(new WorkspaceController(service))
                .addInterceptors(new SaInterceptor())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private static <T> T proxy(Class<T> type, java.lang.reflect.InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler));
    }
}
