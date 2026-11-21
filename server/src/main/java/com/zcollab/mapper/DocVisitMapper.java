package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.DocVisit;
import com.zcollab.vo.doc.DocVisitRow;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface DocVisitMapper extends BaseMapper<DocVisit> {

    @Insert("""
            INSERT INTO doc_visit (id, workspace_id, user_id, doc_id, visited_at)
            VALUES (#{id}, #{workspaceId}, #{userId}, #{docId}, now())
            ON CONFLICT (user_id, doc_id) DO UPDATE
            SET visited_at = now(), workspace_id = excluded.workspace_id
            """)
    int upsertVisit(@Param("id") Long id,
                    @Param("workspaceId") Long workspaceId,
                    @Param("userId") Long userId,
                    @Param("docId") Long docId);

    @Select("""
            SELECT v.doc_id AS id, d.title, v.visited_at
            FROM doc_visit v
            JOIN doc d ON d.id = v.doc_id
            WHERE v.user_id = #{userId}
              AND v.workspace_id = #{workspaceId}
              AND d.deleted_at IS NULL
            ORDER BY v.visited_at DESC, v.id DESC
            LIMIT #{limit}
            """)
    List<DocVisitRow> selectRecent(@Param("userId") Long userId,
                                   @Param("workspaceId") Long workspaceId,
                                   @Param("limit") int limit);
}
