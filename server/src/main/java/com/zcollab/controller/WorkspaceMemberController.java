package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.common.PageRequest;
import com.zcollab.dto.workspace.AddMemberRequest;
import com.zcollab.dto.workspace.RemoveMemberRequest;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.common.PageResponse;
import com.zcollab.vo.workspace.MemberResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspace")
public class WorkspaceMemberController {

    private final WorkspaceMemberService workspaceMemberService;

    public WorkspaceMemberController(WorkspaceMemberService workspaceMemberService) {
        this.workspaceMemberService = workspaceMemberService;
    }

    @PostMapping("/members")
    public ApiResponse<PageResponse<MemberResponse>> members(@RequestBody(required = false) @Valid PageRequest request) {
        return ApiResponse.ok(workspaceMemberService.members(request == null ? new PageRequest() : request));
    }

    @PostMapping("/members/add")
    public ApiResponse<MemberResponse> addMember(@RequestBody @Valid AddMemberRequest request) {
        return ApiResponse.ok(workspaceMemberService.addMember(request.getUsername()));
    }

    @PostMapping("/members/remove")
    public ApiResponse<Void> removeMember(@RequestBody @Valid RemoveMemberRequest request) {
        workspaceMemberService.removeMember(request.getUserId());
        return ApiResponse.ok(null);
    }
}
