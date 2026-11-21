package com.zcollab.controller;

import com.zcollab.common.ApiResponse;
import com.zcollab.dto.doc.CompactDocRequest;
import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.dto.doc.DeleteDocRequest;
import com.zcollab.dto.doc.GetDocRequest;
import com.zcollab.dto.doc.MoveDocRequest;
import com.zcollab.dto.doc.SearchDocRequest;
import com.zcollab.dto.doc.UpdateDocRequest;
import com.zcollab.service.DocService;
import com.zcollab.vo.doc.DocResponse;
import com.zcollab.vo.doc.DocSearchResponse;
import com.zcollab.vo.doc.DocSummaryResponse;
import com.zcollab.vo.share.ShareCreateResponse;
import com.zcollab.vo.share.ShareStatusResponse;
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

    @PostMapping("/claim-seed")
    public ApiResponse<Boolean> claimSeed(@RequestBody @Valid GetDocRequest request) {
        return ApiResponse.ok(docService.claimSeed(request.getId()));
    }

    @PostMapping("/update")
    public ApiResponse<DocResponse> update(@RequestBody @Valid UpdateDocRequest request) {
        return ApiResponse.ok(docService.update(request));
    }

    @PostMapping("/search")
    public ApiResponse<List<DocSearchResponse>> search(@RequestBody @Valid SearchDocRequest request) {
        return ApiResponse.ok(docService.search(request));
    }

    @PostMapping("/delete")
    public ApiResponse<Void> delete(@RequestBody @Valid DeleteDocRequest request) {
        docService.delete(request.getId());
        return ApiResponse.ok();
    }

    @PostMapping("/move")
    public ApiResponse<Void> move(@RequestBody @Valid MoveDocRequest request) {
        docService.move(request.getId(), request.getParentDocId(), request.getBeforeDocId());
        return ApiResponse.ok();
    }

    @PostMapping("/compact")
    public ApiResponse<Void> compact(@RequestBody @Valid CompactDocRequest request) {
        byte[] snapshot;
        try {
            snapshot = Base64.getDecoder().decode(request.getSnapshot());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.BAD_REQUEST);
        }
        docService.compact(request.getId(), snapshot);
        return ApiResponse.ok();
    }

    @PostMapping("/share/create")
    public ApiResponse<ShareCreateResponse> createShare(@RequestBody @Valid GetDocRequest request) {
        return ApiResponse.ok(docService.createShareLink(request.getId()));
    }

    @PostMapping("/share/revoke")
    public ApiResponse<Void> revokeShare(@RequestBody @Valid GetDocRequest request) {
        docService.revokeShareLink(request.getId());
        return ApiResponse.ok();
    }

    @PostMapping("/share/status")
    public ApiResponse<ShareStatusResponse> shareStatus(@RequestBody @Valid GetDocRequest request) {
        return ApiResponse.ok(docService.shareStatus(request.getId()));
    }
}
