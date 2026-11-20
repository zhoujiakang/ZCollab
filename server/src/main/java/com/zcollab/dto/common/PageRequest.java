package com.zcollab.dto.common;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PageRequest {

    @Min(value = 1, message = "page 须大于 0")
    private int page = 1;

    @Min(value = 1, message = "pageSize 须大于 0")
    @Max(value = 100, message = "pageSize 不能超过 100")
    private int pageSize = 20;
}
