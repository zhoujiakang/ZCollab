package com.zcollab.dto.workspace;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateInviteRequest {

    @Min(0)
    @Max(365)
    private Integer expiresInDays;
}
