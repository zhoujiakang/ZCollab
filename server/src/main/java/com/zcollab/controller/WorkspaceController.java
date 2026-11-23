package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.workspace.CreateWorkspaceRequest;
import com.zcollab.dto.workspace.RenameWorkspaceRequest;
import com.zcollab.dto.workspace.SwitchWorkspaceRequest;
import com.zcollab.service.WorkspaceService;
import com.zcollab.vo.workspace.CreateWorkspaceResponse;
import com.zcollab.vo.workspace.WorkspaceInfoResponse;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import cn.dev33.satoken.annotation.SaCheckLogin;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspace")
@SaCheckLogin
public class WorkspaceController {

    private final WorkspaceService workspaceService;

    public WorkspaceController(WorkspaceService workspaceService) {
        this.workspaceService = workspaceService;
    }

    @PostMapping("/create")
    public ApiResponse<CreateWorkspaceResponse> create(@RequestBody @Valid CreateWorkspaceRequest request) {
        return ApiResponse.ok(workspaceService.create(request.getName()));
    }

    @PostMapping("/switch")
    public ApiResponse<WorkspaceSummaryResponse> switchWorkspace(@RequestBody @Valid SwitchWorkspaceRequest request) {
        return ApiResponse.ok(workspaceService.switchTo(request.getId()));
    }

    @PostMapping("/info")
    public ApiResponse<WorkspaceInfoResponse> info() {
        return ApiResponse.ok(workspaceService.info());
    }

    @PostMapping("/rename")
    public ApiResponse<WorkspaceInfoResponse> rename(@RequestBody @Valid RenameWorkspaceRequest request) {
        return ApiResponse.ok(workspaceService.rename(request.getName()));
    }
}
