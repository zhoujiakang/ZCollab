package com.zcollab.context;

import cn.dev33.satoken.stp.StpUtil;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;

@Component
public class WorkspaceContext {

    public static final String ACTIVE_WORKSPACE_ID_KEY = "activeWorkspaceId";
    public static final String WORKSPACE_HEADER = "X-Workspace-Id";

    private String requestWorkspace() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            return attributes.getRequest().getHeader(WORKSPACE_HEADER);
        }
        return null;
    }

    public boolean hasRequestWorkspace() {
        return requestWorkspace() != null;
    }

    public Long getActiveWorkspaceId() {
        if (!StpUtil.isLogin()) {
            return null;
        }
        String requested = requestWorkspace();
        if (requested != null) {
            try {
                if (!requested.matches("[1-9][0-9]*")) throw new NumberFormatException();
                return Long.parseLong(requested);
            } catch (NumberFormatException e) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "工作区 id 不合法");
            }
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
