package com.zcollab.vo.workspace;

import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
public class WorkspaceRow {

    private Long id;
    private String name;
    private String role;
    private OffsetDateTime joinedAt;
}
