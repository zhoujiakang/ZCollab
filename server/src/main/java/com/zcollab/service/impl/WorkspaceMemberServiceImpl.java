package com.zcollab.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.zcollab.context.WorkspaceContext;
import com.zcollab.dto.common.PageRequest;
import com.zcollab.entity.WorkspaceMember;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.WorkspaceMemberMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.common.PageResponse;
import com.zcollab.vo.workspace.MemberResponse;
import com.zcollab.vo.workspace.MemberRow;
import com.zcollab.vo.workspace.WorkspaceMembership;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WorkspaceMemberServiceImpl implements WorkspaceMemberService {

    private final WorkspaceMemberMapper workspaceMemberMapper;
    private final WorkspaceContext workspaceContext;

    public WorkspaceMemberServiceImpl(WorkspaceMemberMapper workspaceMemberMapper,
                                      WorkspaceContext workspaceContext) {
        this.workspaceMemberMapper = workspaceMemberMapper;
        this.workspaceContext = workspaceContext;
    }

    @Override
    public void createOwner(Long workspaceId, long userId) {
        WorkspaceMember member = new WorkspaceMember();
        member.setWorkspaceId(workspaceId);
        member.setUserId(userId);
        member.setRole("owner");
        workspaceMemberMapper.insert(member);
    }

    @Override
    public WorkspaceMembership findMembership(Long workspaceId, long userId) {
        WorkspaceMember member = findMember(workspaceId, userId);
        return member == null ? null : toMembership(member);
    }

    @Override
    public int countByWorkspace(Long workspaceId) {
        Long count = workspaceMemberMapper.selectCount(new LambdaQueryWrapper<WorkspaceMember>()
                .eq(WorkspaceMember::getWorkspaceId, workspaceId));
        return count == null ? 0 : count.intValue();
    }

    @Override
    public List<WorkspaceSummaryResponse> listWorkspaces(long userId) {
        return workspaceMemberMapper.selectWorkspacesByUser(userId).stream()
                .map(row -> new WorkspaceSummaryResponse(row.getId(), row.getName(), row.getRole()))
                .toList();
    }

    @Override
    public PageResponse<WorkspaceSummaryResponse> pageWorkspaces(long userId, PageRequest request) {
        long offset = (long) (request.getPage() - 1) * request.getPageSize();
        return new PageResponse<>(
                workspaceMemberMapper.selectWorkspacePage(userId, request.getPageSize(), offset).stream()
                        .map(row -> new WorkspaceSummaryResponse(row.getId(), row.getName(), row.getRole()))
                        .toList(),
                workspaceMemberMapper.countWorkspacesByUser(userId), request.getPage(), request.getPageSize());
    }

    @Override
    public List<MemberResponse> listByWorkspace(Long workspaceId) {
        return workspaceMemberMapper.selectMembers(workspaceId).stream()
                .map(this::toMember)
                .toList();
    }

    @Override
    public PageResponse<MemberResponse> members(PageRequest request) {
        Long workspaceId = requireCurrentMembership().workspaceId();
        long offset = (long) (request.getPage() - 1) * request.getPageSize();
        return new PageResponse<>(
                workspaceMemberMapper.selectMemberPage(workspaceId, request.getPageSize(), offset).stream()
                        .map(this::toMember)
                        .toList(),
                workspaceMemberMapper.countMembers(workspaceId), request.getPage(), request.getPageSize());
    }

    @Override
    public Long currentWorkspaceId() {
        Long workspaceId = workspaceContext.getActiveWorkspaceId();
        if (workspaceId == null) {
            List<WorkspaceSummaryResponse> workspaces = listWorkspaces(StpUtil.getLoginIdAsLong());
            if (workspaces.isEmpty()) {
                return null;
            }
            workspaceId = workspaces.get(0).id();
            workspaceContext.setActiveWorkspaceId(workspaceId);
        }
        return workspaceId;
    }

    @Override
    public WorkspaceMembership requireCurrentMembership() {
        long userId = StpUtil.getLoginIdAsLong();
        Long workspaceId = currentWorkspaceId();
        WorkspaceMember member = workspaceId == null ? null : findMember(workspaceId, userId);

        if (member == null) {
            workspaceContext.clearActiveWorkspaceId();
            List<WorkspaceSummaryResponse> workspaces = listWorkspaces(userId);
            if (workspaces.isEmpty()) {
                throw new BusinessException(ErrorCode.FORBIDDEN);
            }
            workspaceId = workspaces.get(0).id();
            workspaceContext.setActiveWorkspaceId(workspaceId);
            member = findMember(workspaceId, userId);
            if (member == null) {
                throw new BusinessException(ErrorCode.FORBIDDEN);
            }
        }
        return toMembership(member);
    }

    private WorkspaceMember findMember(Long workspaceId, long userId) {
        return workspaceMemberMapper.selectOne(new LambdaQueryWrapper<WorkspaceMember>()
                .eq(WorkspaceMember::getWorkspaceId, workspaceId)
                .eq(WorkspaceMember::getUserId, userId)
                .last("LIMIT 1"));
    }

    private WorkspaceMembership toMembership(WorkspaceMember member) {
        return new WorkspaceMembership(member.getWorkspaceId(), member.getRole());
    }

    private MemberResponse toMember(MemberRow row) {
        return new MemberResponse(row.getId(), row.getUsername(), row.getName(),
                row.getRole(), row.getJoinedAt());
    }
}
