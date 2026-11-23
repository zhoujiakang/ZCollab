package com.zcollab.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.entity.User;
import com.zcollab.entity.Workspace;
import com.zcollab.entity.WorkspaceInvite;
import com.zcollab.entity.WorkspaceMember;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.UserMapper;
import com.zcollab.mapper.WorkspaceInviteMapper;
import com.zcollab.mapper.WorkspaceMapper;
import com.zcollab.mapper.WorkspaceMemberMapper;
import com.zcollab.service.WorkspaceInviteService;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.workspace.InviteResponse;
import com.zcollab.vo.workspace.MemberRow;
import com.zcollab.vo.workspace.PublicInviteResponse;
import com.zcollab.vo.workspace.WorkspaceMembership;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class WorkspaceInviteServiceImpl implements WorkspaceInviteService {

    private static final String TOKEN_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final int TOKEN_LENGTH = 22;
    private static final SecureRandom TOKEN_RANDOM = new SecureRandom();

    private final WorkspaceInviteMapper inviteMapper;
    private final WorkspaceMemberService workspaceMemberService;
    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final WorkspaceMapper workspaceMapper;
    private final UserMapper userMapper;

    public WorkspaceInviteServiceImpl(WorkspaceInviteMapper inviteMapper,
                                      WorkspaceMemberService workspaceMemberService,
                                      WorkspaceMemberMapper workspaceMemberMapper,
                                      WorkspaceMapper workspaceMapper,
                                      UserMapper userMapper) {
        this.inviteMapper = inviteMapper;
        this.workspaceMemberService = workspaceMemberService;
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.workspaceMapper = workspaceMapper;
        this.userMapper = userMapper;
    }

    @Override
    public InviteResponse create(Integer expiresInDays) {
        WorkspaceMembership membership = workspaceMemberService.requireCurrentMembership();
        int days = expiresInDays == null ? 7 : expiresInDays;
        long userId = StpUtil.getLoginIdAsLong();

        WorkspaceInvite invite = new WorkspaceInvite();
        invite.setWorkspaceId(membership.workspaceId());
        invite.setCreatedBy(userId);
        invite.setExpiresAt(days == 0 ? null : OffsetDateTime.now().plusDays(days));
        invite.setCreatedAt(OffsetDateTime.now());
        invite.setToken(generateToken());
        try {
            inviteMapper.insert(invite);
        } catch (DuplicateKeyException e) {
            // token 唯一键冲突只重试一次，避免异常输入把请求卡在循环里。
            invite.setToken(generateToken());
            inviteMapper.insert(invite);
        }
        return toResponse(invite, userMapper.selectById(userId));
    }

    @Override
    public List<InviteResponse> list() {
        Long workspaceId = workspaceMemberService.requireCurrentMembership().workspaceId();
        List<WorkspaceInvite> invites = inviteMapper.selectActiveByWorkspace(workspaceId, OffsetDateTime.now());
        if (invites.isEmpty()) {
            return List.of();
        }
        Set<Long> creatorIds = invites.stream().map(WorkspaceInvite::getCreatedBy).collect(Collectors.toSet());
        Map<Long, User> creators = userMapper.selectByIds(creatorIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        return invites.stream()
                .map(invite -> toResponse(invite, creators.get(invite.getCreatedBy())))
                .toList();
    }

    @Override
    public void revoke(Long id) {
        WorkspaceInvite invite = inviteMapper.selectById(id);
        if (invite == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        long userId = StpUtil.getLoginIdAsLong();
        WorkspaceMembership membership = workspaceMemberService.findMembership(invite.getWorkspaceId(), userId);
        boolean owner = membership != null && "owner".equals(membership.role());
        boolean creator = invite.getCreatedBy().equals(userId);
        if (!owner && !creator) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        if (invite.getRevokedAt() != null) {
            return;
        }
        inviteMapper.revokeById(id, OffsetDateTime.now());
    }

    @Override
    public WorkspaceSummaryResponse accept(String token) {
        WorkspaceInvite invite = requireUsable(token);
        long userId = StpUtil.getLoginIdAsLong();
        Workspace workspace = workspaceMapper.selectById(invite.getWorkspaceId());
        if (workspace == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }

        MemberRow existing = workspaceMemberMapper.selectMemberRow(invite.getWorkspaceId(), userId);
        String role = "member";
        if (existing != null) {
            role = existing.getRole();
        } else {
            WorkspaceMember member = new WorkspaceMember();
            member.setWorkspaceId(invite.getWorkspaceId());
            member.setUserId(userId);
            member.setRole("member");
            try {
                workspaceMemberMapper.insert(member);
            } catch (DuplicateKeyException ignored) {
                // 并发点击时由 (workspace_id, user_id) 唯一键兜底。
            }
        }
        return new WorkspaceSummaryResponse(workspace.getId(), workspace.getName(), role);
    }

    /** 匿名预览：不读会话、不调用 StpUtil、不访问 WorkspaceContext。 */
    @Override
    public PublicInviteResponse preview(String token) {
        WorkspaceInvite invite = requireUsable(token);
        Workspace workspace = workspaceMapper.selectById(invite.getWorkspaceId());
        if (workspace == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        User inviter = userMapper.selectById(invite.getCreatedBy());
        return new PublicInviteResponse(
                workspace.getName(),
                inviter == null ? null : inviter.getName(),
                workspaceMemberService.countByWorkspace(invite.getWorkspaceId()),
                invite.getExpiresAt());
    }

    private WorkspaceInvite requireUsable(String token) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        WorkspaceInvite invite = inviteMapper.selectByToken(token);
        if (invite == null || invite.getRevokedAt() != null
                || (invite.getExpiresAt() != null && !invite.getExpiresAt().isAfter(OffsetDateTime.now()))) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return invite;
    }

    private static InviteResponse toResponse(WorkspaceInvite invite, User creator) {
        return new InviteResponse(
                invite.getId(),
                invite.getToken(),
                "/invite/" + invite.getToken(),
                invite.getCreatedBy(),
                creator == null ? null : creator.getName(),
                invite.getExpiresAt(),
                invite.getCreatedAt());
    }

    private static String generateToken() {
        StringBuilder token = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i += 1) {
            token.append(TOKEN_ALPHABET.charAt(TOKEN_RANDOM.nextInt(TOKEN_ALPHABET.length())));
        }
        return token.toString();
    }
}
