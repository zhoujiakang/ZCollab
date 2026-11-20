package com.zcollab.vo.user;

import com.zcollab.vo.common.PageResponse;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;

public record CurrentUserResponse(Long id, String username, String name, String avatarUrl,
                                  WorkspaceSummaryResponse activeWorkspace,
                                  PageResponse<WorkspaceSummaryResponse> workspaces) {
}
