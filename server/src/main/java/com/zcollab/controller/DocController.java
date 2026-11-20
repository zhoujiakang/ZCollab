package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.doc.CompactDocRequest;
import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.dto.doc.DeleteDocRequest;
import com.zcollab.dto.doc.GetDocRequest;
import com.zcollab.dto.doc.UpdateDocRequest;
import com.zcollab.service.DocService;
import com.zcollab.vo.doc.DocResponse;
import com.zcollab.vo.doc.DocSummaryResponse;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Base64;
import java.util.List;

@RestController
@RequestMapping("/api/doc")
public class DocController {

    private final DocService docService;

    public DocController(DocService docService) {
        this.docService = docService;
    }

    @PostMapping("/list")
    public ApiResponse<List<DocSummaryResponse>> list() {
        return ApiResponse.ok(docService.list());
    }

    @PostMapping("/create")
    public ApiResponse<DocResponse> create(@RequestBody @Valid CreateDocRequest request) {
        return ApiResponse.ok(docService.create(request));
    }

    @PostMapping("/get")
    public ApiResponse<DocResponse> get(@RequestBody @Valid GetDocRequest request) {
        return ApiResponse.ok(docService.get(request.getId()));
    }

    @PostMapping("/update")
    public ApiResponse<DocResponse> update(@RequestBody @Valid UpdateDocRequest request) {
        return ApiResponse.ok(docService.update(request));
    }

    @PostMapping("/delete")
    public ApiResponse<Boolean> delete(@RequestBody @Valid DeleteDocRequest request) {
        docService.delete(request.getId());
        return ApiResponse.ok(true);
    }

    @PostMapping("/compact")
    public ApiResponse<Boolean> compact(@RequestBody @Valid CompactDocRequest request) {
        byte[] snapshot;
        try {
            snapshot = Base64.getDecoder().decode(request.getSnapshot());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST);
        }
        docService.compact(request.getId(), snapshot);
        return ApiResponse.ok(true);
    }
}
