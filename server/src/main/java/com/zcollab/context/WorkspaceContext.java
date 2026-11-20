package com.zcollab.context;

import cn.dev33.satoken.stp.StpUtil;
import org.springframework.stereotype.Component;

@Component
public class WorkspaceContext {

    public static final String ACTIVE_WORKSPACE_ID_KEY = "activeWorkspaceId";

    public Long getActiveWorkspaceId() {
        if (!StpUtil.isLogin()) {
            return null;
        }
        Object value = StpUtil.getSession(false) == null
                ? null
                : StpUtil.getSession(false).get(ACTIVE_WORKSPACE_ID_KEY);
        return value == null ? null : Long.parseLong(value.toString());
    }

    public void setActiveWorkspaceId(Long workspaceId) {
        StpUtil.getSession().set(ACTIVE_WORKSPACE_ID_KEY, workspaceId);
    }

    public void clearActiveWorkspaceId() {
        if (StpUtil.getSession(false) != null) {
            StpUtil.getSession(false).delete(ACTIVE_WORKSPACE_ID_KEY);
        }
    }
}
