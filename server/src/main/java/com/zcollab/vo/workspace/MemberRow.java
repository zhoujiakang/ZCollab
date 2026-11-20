package com.zcollab.vo.workspace;

import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
public class MemberRow {

    private Long id;
    private String username;
    private String name;
    private String role;
    private OffsetDateTime joinedAt;
}
