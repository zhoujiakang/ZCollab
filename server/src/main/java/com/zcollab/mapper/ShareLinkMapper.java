package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.ShareLink;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;

public interface ShareLinkMapper extends BaseMapper<ShareLink> {

    @Select("""
            SELECT id, doc_id, workspace_id, token, created_by, created_at, revoked_at
            FROM share_link
            WHERE doc_id = #{docId} AND revoked_at IS NULL
            """)
    ShareLink selectActiveByDocId(@Param("docId") Long docId);

    @Select("""
            SELECT id, doc_id, workspace_id, token, created_by, created_at, revoked_at
            FROM share_link
            WHERE token = #{token} AND revoked_at IS NULL
            """)
    ShareLink selectActiveByToken(@Param("token") String token);

    @Update("""
            UPDATE share_link SET revoked_at = #{revokedAt}
            WHERE doc_id = #{docId} AND workspace_id = #{workspaceId} AND revoked_at IS NULL
            """)
    int revokeActiveByDocId(@Param("docId") Long docId,
                            @Param("workspaceId") Long workspaceId,
                            @Param("revokedAt") OffsetDateTime revokedAt);
}
