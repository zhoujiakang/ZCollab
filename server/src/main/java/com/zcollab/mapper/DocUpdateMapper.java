package com.zcollab.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.zcollab.entity.DocUpdate;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.ResultType;
import org.apache.ibatis.annotations.Select;

import java.util.List;

public interface DocUpdateMapper extends BaseMapper<DocUpdate> {

    @Select("SELECT coalesce(max(seq), 0) + 1 FROM doc_update WHERE doc_id = #{docId}")
    long selectNextSeq(@Param("docId") long docId);

    @Select("""
            SELECT id, doc_id, seq, payload, created_at
            FROM doc_update
            WHERE doc_id = #{docId}
            ORDER BY seq ASC
            """)
    @ResultType(DocUpdate.class)
    List<DocUpdate> selectByDocIdOrderBySeq(@Param("docId") long docId);
}
