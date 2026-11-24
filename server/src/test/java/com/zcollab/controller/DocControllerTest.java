package com.zcollab.controller;

import cn.dev33.satoken.SaManager;
import cn.dev33.satoken.context.SaTokenContext;
import cn.dev33.satoken.interceptor.SaInterceptor;
import cn.dev33.satoken.spring.SaTokenContextForSpringInJakartaServlet;
import com.zcollab.exception.GlobalExceptionHandler;
import com.zcollab.service.DocService;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.lang.reflect.Proxy;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DocControllerTest {

    private static SaTokenContext previousContext;

    @BeforeAll
    static void initSaTokenContext() {
        previousContext = SaManager.getSaTokenContext();
        SaManager.setSaTokenContext(new SaTokenContextForSpringInJakartaServlet());
    }

    @AfterAll
    static void restoreSaTokenContext() {
        SaManager.setSaTokenContext(previousContext);
    }

    @Test
    void importRequiresLogin() throws Exception {
        DocService service = (DocService) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{DocService.class},
                (proxy, method, args) -> null);
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new DocController(service))
                .addInterceptors(new SaInterceptor())
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(post("/api/doc/import")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"a\",\"content\":\"{}\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void compactRejectsLegacyRequestWithoutPreparedVersion() throws Exception {
        DocService service = (DocService) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{DocService.class},
                (proxy, method, args) -> { throw new AssertionError("Invalid request reached service"); });
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new DocController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();

        mvc.perform(post("/api/doc/compact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":42,\"snapshot\":\"AAA=\"}"))
                .andExpect(status().isBadRequest());
    }
}
