package com.zcollab.ws;

import cn.dev33.satoken.stp.StpUtil;
import org.springframework.web.socket.WebSocketSession;

import static com.zcollab.ws.CollabHandshakeInterceptor.*;

final class CollabSessionToken {
    private CollabSessionToken() {}

    static boolean isValid(WebSocketSession session) {
        Object token = session.getAttributes().get(ATTR_TOKEN);
        Object userId = session.getAttributes().get(ATTR_USER_ID);
        if (!(token instanceof String value) || value.isBlank() || userId == null) return false;
        Object loginId = StpUtil.getLoginIdByToken(value);
        return loginId != null && userId.toString().equals(loginId.toString());
    }
}
