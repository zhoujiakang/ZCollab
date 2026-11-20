package com.zcollab.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;
import org.apache.ibatis.type.ByteArrayTypeHandler;

import java.time.OffsetDateTime;

@Getter
@Setter
@TableName("doc_update")
public class DocUpdate {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long docId;

    private Long seq;

    @TableField(typeHandler = ByteArrayTypeHandler.class)
    private byte[] payload;

    private OffsetDateTime createdAt;
}
