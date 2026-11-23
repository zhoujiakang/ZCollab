package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.WorkspaceInvite;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.List;

public interface WorkspaceInviteMapper extends BaseMapper<WorkspaceInvite> {

    @Select("""
            SELECT id, workspace_id, token, created_by, expires_at, revoked_at, created_at
            FROM workspace_invite
            WHERE token = #{token}
            """)
    WorkspaceInvite selectByToken(@Param("token") String token);

    @Select("""
            SELECT id, workspace_id, token, created_by, expires_at, revoked_at, created_at
            FROM workspace_invite
            WHERE workspace_id = #{workspaceId}
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > #{now})
            ORDER BY created_at DESC
            LIMIT 20
            """)
    List<WorkspaceInvite> selectActiveByWorkspace(@Param("workspaceId") Long workspaceId,
                                                  @Param("now") OffsetDateTime now);

    @Update("""
            UPDATE workspace_invite SET revoked_at = #{revokedAt}
            WHERE id = #{id} AND revoked_at IS NULL
            """)
    int revokeById(@Param("id") Long id, @Param("revokedAt") OffsetDateTime revokedAt);
}
