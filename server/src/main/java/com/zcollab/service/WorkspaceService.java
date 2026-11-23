package com.zcollab.service;

import com.zcollab.dto.common.PageRequest;
import com.zcollab.vo.common.PageResponse;
import com.zcollab.vo.workspace.CreateWorkspaceResponse;
import com.zcollab.vo.workspace.WorkspaceInfoResponse;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;

import java.util.List;

public interface WorkspaceService {

    CreateWorkspaceResponse create(String rawName);

    WorkspaceSummaryResponse switchTo(Long workspaceId);

    WorkspaceInfoResponse info();

    WorkspaceInfoResponse rename(String rawName);

    List<WorkspaceSummaryResponse> myWorkspaces(long userId);

    PageResponse<WorkspaceSummaryResponse> myWorkspacePage(long userId, PageRequest request);

    WorkspaceSummaryResponse resolveActiveWorkspace(List<WorkspaceSummaryResponse> workspaces);
}
