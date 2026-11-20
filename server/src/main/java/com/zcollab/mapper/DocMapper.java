package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.Doc;
import com.zcollab.vo.doc.DocSummaryRow;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface DocMapper extends BaseMapper<Doc> {

    @Select("""
            SELECT id, parent_doc_id, title
            FROM doc
            WHERE workspace_id = #{workspaceId} AND deleted_at IS NULL
            ORDER BY created_at ASC, id ASC
            """)
    List<DocSummaryRow> selectByWorkspace(@Param("workspaceId") Long workspaceId);

    @Select("""
            WITH RECURSIVE descendants AS (
                SELECT id FROM doc
                WHERE id = #{id} AND workspace_id = #{workspaceId} AND deleted_at IS NULL
                UNION
                SELECT d.id FROM doc d
                JOIN descendants x ON d.parent_doc_id = x.id
                WHERE d.workspace_id = #{workspaceId} AND d.deleted_at IS NULL
            )
            SELECT id FROM descendants
            """)
    List<Long> selectDescendantIds(@Param("id") Long id, @Param("workspaceId") Long workspaceId);
}
