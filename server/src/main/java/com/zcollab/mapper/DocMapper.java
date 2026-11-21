package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.Doc;
import com.zcollab.vo.doc.DocSearchRow;
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
            ORDER BY sort_order ASC, created_at ASC, id ASC
            """)
    List<DocSummaryRow> selectByWorkspace(@Param("workspaceId") Long workspaceId);

    @Select("""
            SELECT COALESCE(MAX(sort_order), -1) + 1
            FROM doc
            WHERE workspace_id = #{workspaceId}
              AND parent_doc_id IS NOT DISTINCT FROM #{parentDocId}
              AND deleted_at IS NULL
            """)
    int selectNextSortOrder(@Param("workspaceId") Long workspaceId,
                            @Param("parentDocId") Long parentDocId);

    @Select("""
            SELECT id
            FROM doc
            WHERE workspace_id = #{workspaceId}
              AND parent_doc_id IS NOT DISTINCT FROM #{parentDocId}
              AND deleted_at IS NULL
              AND id != #{excludeId}
            ORDER BY sort_order ASC, created_at ASC, id ASC
            """)
    List<Long> selectSortedSiblingIds(@Param("workspaceId") Long workspaceId,
                                      @Param("parentDocId") Long parentDocId,
                                      @Param("excludeId") Long excludeId);

    @Update("""
            UPDATE doc SET sort_order = #{sortOrder}
            WHERE id = #{id} AND workspace_id = #{workspaceId} AND deleted_at IS NULL
            """)
    int updateSortOrder(@Param("id") Long id,
                        @Param("workspaceId") Long workspaceId,
                        @Param("sortOrder") int sortOrder);

    @Select("""
            SELECT id, title, content_text,
                   CASE
                       WHEN title ILIKE '%' || #{likeKeyword} || '%' THEN 100 + similarity(title, #{keyword})
                       ELSE similarity(content_text, #{keyword})
                   END AS score
            FROM doc
            WHERE workspace_id = #{workspaceId}
              AND deleted_at IS NULL
              AND (title ILIKE '%' || #{likeKeyword} || '%'
                   OR content_text ILIKE '%' || #{likeKeyword} || '%')
            ORDER BY score DESC, updated_at DESC
            LIMIT #{limit}
            """)
    List<DocSearchRow> search(@Param("workspaceId") Long workspaceId,
                              @Param("keyword") String keyword,
                              @Param("likeKeyword") String likeKeyword,
                              @Param("limit") int limit);

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
