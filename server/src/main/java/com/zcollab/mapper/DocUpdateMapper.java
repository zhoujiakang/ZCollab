package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.DocUpdate;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultType;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface DocUpdateMapper extends BaseMapper<DocUpdate> {

    /** 收缩会删掉历史行，编号必须同时避开 doc.snapshot_seq，否则新 update 会从 1 开始被跳过。 */
    @Select("""
            SELECT greatest(
                (SELECT coalesce(max(seq), 0) FROM doc_update WHERE doc_id = #{docId}),
                (SELECT coalesce(snapshot_seq, 0) FROM doc WHERE id = #{docId})
            ) + 1
            """)
    long selectNextSeq(@Param("docId") long docId);

    @Select("""
            SELECT id, doc_id, seq, payload, created_at
            FROM doc_update
            WHERE doc_id = #{docId} AND seq > #{afterSeq}
            ORDER BY seq ASC
            """)
    @ResultType(DocUpdate.class)
    List<DocUpdate> selectByDocIdOrderBySeq(@Param("docId") long docId, @Param("afterSeq") long afterSeq);

    @Delete("DELETE FROM doc_update WHERE doc_id = #{docId} AND seq <= #{seq}")
    int deleteByDocIdAndSeqLessThanEqual(@Param("docId") long docId, @Param("seq") long seq);
}
