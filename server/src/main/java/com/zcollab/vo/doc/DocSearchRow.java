package com.zcollab.vo.doc;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DocSearchRow {

    private Long id;
    private String title;
    private String contentText;
    private Double score;
}
