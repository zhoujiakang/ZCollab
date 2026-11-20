package com.zcollab.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@TableName("workspace")
public class Workspace {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private String name;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
