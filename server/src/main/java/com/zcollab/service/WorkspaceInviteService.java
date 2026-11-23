package com.zcollab.service;

import com.zcollab.vo.workspace.InviteResponse;
import com.zcollab.vo.workspace.PublicInviteResponse;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;

import java.util.List;

public interface WorkspaceInviteService {

    InviteResponse create(Integer expiresInDays);

    List<InviteResponse> list();

    void revoke(Long id);

    WorkspaceSummaryResponse accept(String token);

    PublicInviteResponse preview(String token);
}
