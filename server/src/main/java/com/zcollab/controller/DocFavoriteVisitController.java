package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.doc.GetDocRequest;
import com.zcollab.service.DocFavoriteVisitService;
import com.zcollab.vo.doc.DocFavoriteResponse;
import com.zcollab.vo.doc.DocRecentResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/doc")
public class DocFavoriteVisitController {

    private final DocFavoriteVisitService service;

    public DocFavoriteVisitController(DocFavoriteVisitService service) {
        this.service = service;
    }

    @PostMapping("/favorite/toggle")
    public ApiResponse<Boolean> toggleFavorite(@RequestBody @Valid GetDocRequest request) {
        return ApiResponse.ok(service.toggleFavorite(request.getId()));
    }

    @PostMapping("/favorites")
    public ApiResponse<List<DocFavoriteResponse>> favorites() {
        return ApiResponse.ok(service.listFavorites());
    }

    @PostMapping("/visit")
    public ApiResponse<Boolean> visit(@RequestBody @Valid GetDocRequest request) {
        service.recordVisit(request.getId());
        return ApiResponse.ok(true);
    }

    @PostMapping("/recent")
    public ApiResponse<List<DocRecentResponse>> recent() {
        return ApiResponse.ok(service.listRecent());
    }
}
