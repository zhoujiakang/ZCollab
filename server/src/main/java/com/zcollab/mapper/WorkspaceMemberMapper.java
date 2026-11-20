package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.WorkspaceMember;
import com.zcollab.vo.workspace.MemberRow;
import com.zcollab.vo.workspace.WorkspaceRow;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface WorkspaceMemberMapper extends BaseMapper<WorkspaceMember> {

    @Select("""
            SELECT u.id AS id, u.username AS username, u.name AS name,
                   m.role AS role, m.created_at AS joined_at
            FROM workspace_member m
            JOIN sys_user u ON u.id = m.user_id
            WHERE m.workspace_id = #{workspaceId}
            ORDER BY m.created_at ASC, m.id ASC
            """)
    List<MemberRow> selectMembers(@Param("workspaceId") Long workspaceId);

    @Select("""
            SELECT u.id AS id, u.username AS username, u.name AS name,
                   m.role AS role, m.created_at AS joined_at
            FROM workspace_member m
            JOIN sys_user u ON u.id = m.user_id
            WHERE m.workspace_id = #{workspaceId}
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT #{size} OFFSET #{offset}
            """)
    List<MemberRow> selectMemberPage(@Param("workspaceId") Long workspaceId,
                                     @Param("size") int size, @Param("offset") long offset);

    @Select("SELECT count(*) FROM workspace_member WHERE workspace_id = #{workspaceId}")
    long countMembers(@Param("workspaceId") Long workspaceId);

    @Select("""
            SELECT w.id AS id, w.name AS name,
                   m.role AS role, m.created_at AS joined_at
            FROM workspace_member m
            JOIN workspace w ON w.id = m.workspace_id
            WHERE m.user_id = #{userId}
            ORDER BY m.created_at ASC, m.id ASC
            """)
    List<WorkspaceRow> selectWorkspacesByUser(@Param("userId") Long userId);

    @Select("""
            SELECT w.id AS id, w.name AS name,
                   m.role AS role, m.created_at AS joined_at
            FROM workspace_member m
            JOIN workspace w ON w.id = m.workspace_id
            WHERE m.user_id = #{userId}
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT #{size} OFFSET #{offset}
            """)
    List<WorkspaceRow> selectWorkspacePage(@Param("userId") Long userId,
                                           @Param("size") int size, @Param("offset") long offset);

    @Select("SELECT count(*) FROM workspace_member WHERE user_id = #{userId}")
    long countWorkspacesByUser(@Param("userId") Long userId);
}
