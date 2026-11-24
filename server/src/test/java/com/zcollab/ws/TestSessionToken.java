package com.zcollab.ws;

import cn.dev33.satoken.SaManager;
import cn.dev33.satoken.stp.StpUtil;
import java.util.Map;
import java.util.UUID;
import static com.zcollab.ws.CollabHandshakeInterceptor.*;

final class TestSessionToken {
    static String issue(Map<String, Object> attributes, long userId) {
        String token = UUID.randomUUID().toString();
        SaManager.getSaTokenDao().set(StpUtil.getStpLogic().splicingKeyTokenValue(token), Long.toString(userId), 3600);
        attributes.put(ATTR_TOKEN, token);
        attributes.put(ATTR_USER_ID, userId);
        return token;
    }

    static void revoke(Map<String, Object> attributes) {
        SaManager.getSaTokenDao().delete(StpUtil.getStpLogic().splicingKeyTokenValue((String) attributes.get(ATTR_TOKEN)));
    }
}
