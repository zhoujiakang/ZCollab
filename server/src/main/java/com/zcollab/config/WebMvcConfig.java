package com.zcollab.config;

import cn.dev33.satoken.interceptor.SaInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 只注册 Sa-Token 的注解鉴权拦截器，不启用 @EnableWebMvc，保留 Boot 默认 MVC 配置。
 *
 * 约定：后续新增 Controller / 接口时必须先决定是否要求登录。绝大多数接口要求登录，
 * 请在类（或方法）上加 @SaCheckLogin；只有登录、注册、健康检查、公开分享才允许匿名访问。
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 无参构造：isAnnotation 默认为 true、auth 为空实现，仅执行注解鉴权。
        // @SaCheckLogin 靠该拦截器的 preHandle 触发，只打注解不注册拦截器不会拦住任何请求。
        registry.addInterceptor(new SaInterceptor()).addPathPatterns("/api/**");
    }
}
