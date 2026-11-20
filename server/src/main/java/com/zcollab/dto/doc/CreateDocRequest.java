package com.zcollab.dto.doc;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateDocRequest {

    private Long parentDocId;

    @Size(max = 255, message = "标题不能超过 255 位")
    private String title;
}
