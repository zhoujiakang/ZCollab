package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.service.WorkspaceInviteService;
import com.zcollab.vo.workspace.PublicInviteResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/invite")
public class PublicInviteController {

    private final WorkspaceInviteService workspaceInviteService;

    public PublicInviteController(WorkspaceInviteService workspaceInviteService) {
        this.workspaceInviteService = workspaceInviteService;
    }

    @GetMapping("/{token}")
    public ApiResponse<PublicInviteResponse> preview(@PathVariable String token) {
        return ApiResponse.ok(workspaceInviteService.preview(token));
    }
}
