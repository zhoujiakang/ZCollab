package com.zcollab.service;

/** Published when a member leaves or is removed from a workspace. */
public record WorkspaceMemberRemoved(Long workspaceId, long userId) {
}
