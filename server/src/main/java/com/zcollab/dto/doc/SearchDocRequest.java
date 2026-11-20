package com.zcollab.dto.doc;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SearchDocRequest {

    private String keyword;

    private Integer limit;
}
