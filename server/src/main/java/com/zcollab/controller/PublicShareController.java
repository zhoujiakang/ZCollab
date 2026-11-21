package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.service.PublicShareService;
import com.zcollab.vo.share.PublicShareResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/share")
public class PublicShareController {

    private final PublicShareService publicShareService;

    public PublicShareController(PublicShareService publicShareService) {
        this.publicShareService = publicShareService;
    }

    @GetMapping("/{token}")
    public ApiResponse<PublicShareResponse> get(@PathVariable String token) {
        return ApiResponse.ok(publicShareService.getSharedDoc(token));
    }
}
