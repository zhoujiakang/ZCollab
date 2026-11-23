package com.zcollab.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.zcollab.dto.common.PageRequest;
import com.zcollab.dto.user.UpdateProfileRequest;
import com.zcollab.entity.User;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.UserMapper;
import com.zcollab.service.UserService;
import com.zcollab.service.WorkspaceService;
import com.zcollab.vo.common.PageResponse;
import com.zcollab.vo.user.CurrentUserResponse;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final WorkspaceService workspaceService;

    public UserServiceImpl(UserMapper userMapper, WorkspaceService workspaceService) {
        this.userMapper = userMapper;
        this.workspaceService = workspaceService;
    }

    @Override
    public CurrentUserResponse me(PageRequest request) {
        StpUtil.checkLogin();
        long userId = StpUtil.getLoginIdAsLong();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        List<WorkspaceSummaryResponse> allWorkspaces = workspaceService.myWorkspaces(userId);
        WorkspaceSummaryResponse activeWorkspace = workspaceService.resolveActiveWorkspace(allWorkspaces);
        PageResponse<WorkspaceSummaryResponse> workspaces = workspaceService.myWorkspacePage(userId, request);
        return new CurrentUserResponse(user.getId(), user.getUsername(), user.getName(),
                user.getAvatarUrl(), activeWorkspace, workspaces);
    }

    @Override
    public CurrentUserResponse updateProfile(UpdateProfileRequest request) {
        long userId = StpUtil.getLoginIdAsLong();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }

        String name = request.getName().trim();
        if (name.isEmpty()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "昵称不能为空");
        }

        String avatarUrl = request.getAvatarUrl();
        if (avatarUrl != null && avatarUrl.isEmpty()) {
            avatarUrl = null;
        }
        if (avatarUrl != null && !avatarUrl.startsWith("/files/")) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "头像地址不合法");
        }

        userMapper.update(null, new LambdaUpdateWrapper<User>()
                .set(User::getName, name)
                .set(User::getAvatarUrl, avatarUrl)
                .set(User::getUpdatedAt, OffsetDateTime.now())
                .eq(User::getId, userId));

        return me(new PageRequest());
    }
}
