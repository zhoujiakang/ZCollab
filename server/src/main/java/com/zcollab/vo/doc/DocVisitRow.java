package com.zcollab.vo.doc;

import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
public class DocVisitRow {

    private Long id;
    private String title;
    private OffsetDateTime visitedAt;
}
