package com.zcollab.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import com.zcollab.common.ApiResponse;
import com.zcollab.dto.workspace.AcceptInviteRequest;
import com.zcollab.dto.workspace.CreateInviteRequest;
import com.zcollab.dto.workspace.RevokeInviteRequest;
import com.zcollab.service.WorkspaceInviteService;
import com.zcollab.vo.workspace.InviteResponse;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/workspace/invites")
@SaCheckLogin
public class WorkspaceInviteController {

    private final WorkspaceInviteService workspaceInviteService;

    public WorkspaceInviteController(WorkspaceInviteService workspaceInviteService) {
        this.workspaceInviteService = workspaceInviteService;
    }

    @PostMapping
    public ApiResponse<InviteResponse> create(@RequestBody(required = false) @Valid CreateInviteRequest request) {
        Integer days = request == null ? null : request.getExpiresInDays();
        return ApiResponse.ok(workspaceInviteService.create(days));
    }

    @PostMapping("/list")
    public ApiResponse<List<InviteResponse>> list() {
        return ApiResponse.ok(workspaceInviteService.list());
    }

    @PostMapping("/revoke")
    public ApiResponse<Void> revoke(@RequestBody @Valid RevokeInviteRequest request) {
        workspaceInviteService.revoke(request.getId());
        return ApiResponse.ok();
    }

    @PostMapping("/accept")
    public ApiResponse<WorkspaceSummaryResponse> accept(@RequestBody @Valid AcceptInviteRequest request) {
        return ApiResponse.ok(workspaceInviteService.accept(request.getToken()));
    }
}
