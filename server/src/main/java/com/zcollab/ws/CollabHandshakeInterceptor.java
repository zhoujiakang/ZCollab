package com.zcollab.ws;

import cn.dev33.satoken.exception.NotLoginException;
import cn.dev33.satoken.session.SaSession;
import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.context.WorkspaceContext;
import com.zcollab.entity.Doc;
import com.zcollab.mapper.DocMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class CollabHandshakeInterceptor implements HandshakeInterceptor {

    public static final String ATTR_CLOSE_CODE = "collab.closeCode";
    public static final String ATTR_CLOSE_REASON = "collab.closeReason";
    public static final String ATTR_USER_ID = "collab.userId";
    public static final String ATTR_DOC_ID = "collab.docId";
    public static final String ATTR_WORKSPACE_ID = "collab.workspaceId";
    public static final String ATTR_LAST_ACTIVE_AT = "collab.lastActiveAt";

    public static final int CLOSE_OK = 0;
    public static final int CLOSE_UNAUTHORIZED = 4401;
    public static final int CLOSE_NOT_FOUND = 4404;
    public static final int CLOSE_SERVER_ERROR = 4500;

    private static final Logger log = LoggerFactory.getLogger(CollabHandshakeInterceptor.class);
    private static final Pattern DOC_PATH = Pattern.compile("^/collab/(\\d+)$");

    private final DocMapper docMapper;
    private final WorkspaceMemberService workspaceMemberService;
    private final String tokenName;

    public CollabHandshakeInterceptor(DocMapper docMapper,
                                      WorkspaceMemberService workspaceMemberService,
                                      @Value("${sa-token.token-name:authToken}") String tokenName) {
        this.docMapper = docMapper;
        this.workspaceMemberService = workspaceMemberService;
        this.tokenName = tokenName;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        int closeCode = CLOSE_OK;
        String reason = "";
        Long docId = null;
        Long userId = null;
        Long workspaceId = null;

        try {
            docId = extractDocId(request.getURI().getPath());
            if (docId == null) {
                closeCode = CLOSE_NOT_FOUND;
                reason = "文档不存在";
            } else {
                String token = readToken(request);
                if (token == null || token.isBlank()) {
                    closeCode = CLOSE_UNAUTHORIZED;
                    reason = "未登录";
                } else {
                    Object loginId = StpUtil.getLoginIdByToken(token);
                    if (loginId == null) {
                        closeCode = CLOSE_UNAUTHORIZED;
                        reason = "登录已失效";
                    } else {
                        userId = Long.valueOf(loginId.toString());
                        workspaceId = resolveWorkspaceId(userId);
                        if (workspaceId == null) {
                            closeCode = CLOSE_NOT_FOUND;
                            reason = "没有可用的工作区";
                        } else {
                            Doc doc = docMapper.selectById(docId);
                            if (doc == null || doc.getDeletedAt() != null
                                    || !workspaceId.equals(doc.getWorkspaceId())) {
                                closeCode = CLOSE_NOT_FOUND;
                                reason = "文档不存在或不属于当前工作区";
                            }
                        }
                    }
                }
            }
        } catch (NotLoginException e) {
            closeCode = CLOSE_UNAUTHORIZED;
            reason = "登录已失效";
        } catch (NumberFormatException e) {
            closeCode = CLOSE_UNAUTHORIZED;
            reason = "登录态无效";
        } catch (Exception e) {
            log.error("WebSocket 握手校验内部错误", e);
            closeCode = CLOSE_SERVER_ERROR;
            reason = "服务端内部错误";
        }

        attributes.put(ATTR_CLOSE_CODE, closeCode);
        attributes.put(ATTR_CLOSE_REASON, reason);
        attributes.put(ATTR_DOC_ID, docId);
        attributes.put(ATTR_USER_ID, userId);
        attributes.put(ATTR_WORKSPACE_ID, workspaceId);
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
    }

    private String readToken(ServerHttpRequest request) {
        String cookieHeader = request.getHeaders().getFirst(HttpHeaders.COOKIE);
        if (cookieHeader == null || cookieHeader.isBlank()) {
            return null;
        }
        for (String part : cookieHeader.split(";")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length == 2 && tokenName.equals(pair[0])) {
                return pair[1];
            }
        }
        return null;
    }

    private Long extractDocId(String path) {
        if (path == null) {
            return null;
        }
        Matcher matcher = DOC_PATH.matcher(path);
        if (!matcher.matches()) {
            return null;
        }
        try {
            return Long.valueOf(matcher.group(1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private Long resolveWorkspaceId(long userId) {
        SaSession session = StpUtil.getSessionByLoginId(userId, false);
        Long activeWorkspaceId = null;
        if (session != null) {
            Object value = session.get(WorkspaceContext.ACTIVE_WORKSPACE_ID_KEY);
            if (value != null) {
                activeWorkspaceId = Long.valueOf(value.toString());
            }
        }
        if (activeWorkspaceId != null
                && workspaceMemberService.findMembership(activeWorkspaceId, userId) != null) {
            return activeWorkspaceId;
        }

        List<WorkspaceSummaryResponse> workspaces = workspaceMemberService.listWorkspaces(userId);
        if (workspaces.isEmpty()) {
            return null;
        }
        Long fallback = workspaces.get(0).id();
        if (session == null) {
            session = StpUtil.getSessionByLoginId(userId, true);
        }
        session.set(WorkspaceContext.ACTIVE_WORKSPACE_ID_KEY, fallback);
        return fallback;
    }
}
