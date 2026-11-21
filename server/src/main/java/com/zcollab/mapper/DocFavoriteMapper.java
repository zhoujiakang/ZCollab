package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.DocFavorite;
import com.zcollab.vo.doc.DocFavoriteRow;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface DocFavoriteMapper extends BaseMapper<DocFavorite> {

    @Select("""
            SELECT id, workspace_id, user_id, doc_id, created_at
            FROM doc_favorite
            WHERE user_id = #{userId} AND doc_id = #{docId}
            LIMIT 1
            """)
    DocFavorite selectByUserAndDoc(@Param("userId") Long userId, @Param("docId") Long docId);

    @Insert("""
            INSERT INTO doc_favorite (id, workspace_id, user_id, doc_id, created_at)
            VALUES (#{id}, #{workspaceId}, #{userId}, #{docId}, now())
            """)
    int insertFavorite(@Param("id") Long id,
                       @Param("workspaceId") Long workspaceId,
                       @Param("userId") Long userId,
                       @Param("docId") Long docId);

    @Delete("DELETE FROM doc_favorite WHERE id = #{id}")
    int deleteFavorite(@Param("id") Long id);

    @Select("""
            SELECT f.doc_id AS id, d.title
            FROM doc_favorite f
            JOIN doc d ON d.id = f.doc_id
            WHERE f.user_id = #{userId}
              AND f.workspace_id = #{workspaceId}
              AND d.deleted_at IS NULL
            ORDER BY f.created_at DESC, f.id DESC
            LIMIT #{limit}
            """)
    List<DocFavoriteRow> selectFavorites(@Param("userId") Long userId,
                                         @Param("workspaceId") Long workspaceId,
                                         @Param("limit") int limit);
}
