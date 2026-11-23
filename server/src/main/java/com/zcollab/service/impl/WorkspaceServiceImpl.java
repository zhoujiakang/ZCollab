package com.zcollab.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.zcollab.context.WorkspaceContext;
import com.zcollab.dto.common.PageRequest;
import com.zcollab.entity.Workspace;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.WorkspaceMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.service.WorkspaceService;
import com.zcollab.vo.common.PageResponse;
import com.zcollab.vo.workspace.CreateWorkspaceResponse;
import com.zcollab.vo.workspace.WorkspaceInfoResponse;
import com.zcollab.vo.workspace.WorkspaceMembership;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class WorkspaceServiceImpl implements WorkspaceService {

    private final WorkspaceMapper workspaceMapper;
    private final WorkspaceMemberService workspaceMemberService;
    private final WorkspaceContext workspaceContext;

    public WorkspaceServiceImpl(WorkspaceMapper workspaceMapper,
                                WorkspaceMemberService workspaceMemberService,
                                WorkspaceContext workspaceContext) {
        this.workspaceMapper = workspaceMapper;
        this.workspaceMemberService = workspaceMemberService;
        this.workspaceContext = workspaceContext;
    }

    @Override
    @Transactional
    public CreateWorkspaceResponse create(String rawName) {
        String name = rawName.trim();
        long userId = StpUtil.getLoginIdAsLong();

        Workspace workspace = new Workspace();
        workspace.setName(name);
        workspaceMapper.insert(workspace);
        workspaceMemberService.createOwner(workspace.getId(), userId);

        workspaceContext.setActiveWorkspaceId(workspace.getId());
        return new CreateWorkspaceResponse(workspace.getId(), workspace.getName());
    }

    @Override
    public WorkspaceSummaryResponse switchTo(Long workspaceId) {
        long userId = StpUtil.getLoginIdAsLong();
        WorkspaceMembership membership = workspaceMemberService.findMembership(workspaceId, userId);
        if (membership == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        Workspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        workspaceContext.setActiveWorkspaceId(workspaceId);
        return toSummary(workspace, membership.role());
    }

    @Override
    public WorkspaceInfoResponse info() {
        WorkspaceMembership membership = workspaceMemberService.requireCurrentMembership();
        Workspace workspace = workspaceMapper.selectById(membership.workspaceId());
        if (workspace == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        return new WorkspaceInfoResponse(workspace.getId(), workspace.getName(), membership.role(),
                workspaceMemberService.countByWorkspace(workspace.getId()));
    }

    @Override
    public WorkspaceInfoResponse rename(String rawName) {
        WorkspaceMembership membership = workspaceMemberService.requireCurrentMembership();
        if (!"owner".equals(membership.role())) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        String name = rawName == null ? "" : rawName.trim();
        if (name.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST);
        }
        workspaceMapper.update(null, new LambdaUpdateWrapper<Workspace>()
                .set(Workspace::getName, name)
                .eq(Workspace::getId, membership.workspaceId()));
        return info();
    }

    @Override
    public List<WorkspaceSummaryResponse> myWorkspaces(long userId) {
        return workspaceMemberService.listWorkspaces(userId);
    }

    @Override
    public PageResponse<WorkspaceSummaryResponse> myWorkspacePage(long userId, PageRequest request) {
        return workspaceMemberService.pageWorkspaces(userId, request);
    }

    @Override
    public WorkspaceSummaryResponse resolveActiveWorkspace(List<WorkspaceSummaryResponse> workspaces) {
        Long activeId = workspaceContext.getActiveWorkspaceId();
        if (activeId != null) {
            Optional<WorkspaceSummaryResponse> active = workspaces.stream()
                    .filter(workspace -> workspace.id().equals(activeId))
                    .findFirst();
            if (active.isPresent()) {
                return active.get();
            }
            workspaceContext.clearActiveWorkspaceId();
        }
        if (workspaces.isEmpty()) {
            return null;
        }
        WorkspaceSummaryResponse first = workspaces.get(0);
        workspaceContext.setActiveWorkspaceId(first.id());
        return first;
    }

    private WorkspaceSummaryResponse toSummary(Workspace workspace, String role) {
        return new WorkspaceSummaryResponse(workspace.getId(), workspace.getName(), role);
    }
}
