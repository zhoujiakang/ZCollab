package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.Doc;
import com.zcollab.vo.doc.DocSnapshotRow;
import com.zcollab.vo.doc.DocSummaryRow;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultType;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

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

    @Select("SELECT snapshot, snapshot_seq FROM doc WHERE id = #{docId}")
    @ResultType(DocSnapshotRow.class)
    DocSnapshotRow selectSnapshot(@Param("docId") long docId);

    @Update("UPDATE doc SET snapshot = #{snapshot}, snapshot_seq = #{snapshotSeq} WHERE id = #{docId}")
    int updateSnapshot(@Param("docId") long docId,
                       @Param("snapshot") byte[] snapshot,
                       @Param("snapshotSeq") long snapshotSeq);

    @Select("""
            WITH claimed AS (
                UPDATE doc SET seed_claimed_at = now()
                WHERE id = #{id} AND deleted_at IS NULL AND snapshot_seq = 0
                  AND NOT EXISTS (SELECT 1 FROM doc_update WHERE doc_id = #{id})
                  AND (seed_claimed_at IS NULL OR seed_claimed_at < now() - interval '60 seconds')
                RETURNING id
            )
            SELECT COUNT(*) FROM claimed
            """)
    int claimSeed(@Param("id") Long id);
}
