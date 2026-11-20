package com.zcollab.ws;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
@EnableScheduling
public class CollabWebSocketConfig implements WebSocketConfigurer {

    private static final int BINARY_BUFFER_SIZE = 1024 * 1024;

    private final CollabWebSocketHandler handler;
    private final CollabHandshakeInterceptor interceptor;

    public CollabWebSocketConfig(CollabWebSocketHandler handler, CollabHandshakeInterceptor interceptor) {
        this.handler = handler;
        this.interceptor = interceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(handler, "/collab/*")
                .addInterceptors(interceptor)
                .setAllowedOrigins("http://localhost:5173", "http://127.0.0.1:5173");
    }

    @Bean
    public ServletServerContainerFactoryBean webSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxBinaryMessageBufferSize(BINARY_BUFFER_SIZE);
        return container;
    }
}
