package com.zcollab.service;

import com.zcollab.dto.common.PageRequest;
import com.zcollab.vo.common.PageResponse;
import com.zcollab.vo.workspace.MemberResponse;
import com.zcollab.vo.workspace.WorkspaceMembership;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;

import java.util.List;

public interface WorkspaceMemberService {

    void createOwner(Long workspaceId, long userId);

    WorkspaceMembership findMembership(Long workspaceId, long userId);

    int countByWorkspace(Long workspaceId);

    List<WorkspaceSummaryResponse> listWorkspaces(long userId);

    PageResponse<WorkspaceSummaryResponse> pageWorkspaces(long userId, PageRequest request);

    List<MemberResponse> listByWorkspace(Long workspaceId);

    PageResponse<MemberResponse> members(PageRequest request);

    MemberResponse addMember(String username);

    void removeMember(Long userId);

    void transferOwner(Long userId);

    Long currentWorkspaceId();

    WorkspaceMembership requireCurrentMembership();
}
