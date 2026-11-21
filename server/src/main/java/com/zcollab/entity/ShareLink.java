package com.zcollab.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@TableName("share_link")
public class ShareLink {

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;

    private Long docId;

    private Long workspaceId;

    private String token;

    private Long createdBy;

    private OffsetDateTime createdAt;

    private OffsetDateTime revokedAt;
}
