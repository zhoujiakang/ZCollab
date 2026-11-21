package com.zcollab.service;

import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.dto.doc.SearchDocRequest;
import com.zcollab.dto.doc.UpdateDocRequest;
import com.zcollab.vo.doc.DocResponse;
import com.zcollab.vo.doc.DocSearchResponse;
import com.zcollab.vo.doc.DocSummaryResponse;
import com.zcollab.vo.share.ShareCreateResponse;
import com.zcollab.vo.share.ShareStatusResponse;

import java.util.List;

public interface DocService {

    List<DocSummaryResponse> list();

    List<DocSearchResponse> search(SearchDocRequest request);

    DocResponse create(CreateDocRequest request);

    DocResponse get(Long id);

    boolean claimSeed(Long id);

    DocResponse update(UpdateDocRequest request);

    void delete(Long id);

    void move(Long id, Long parentId, Long beforeDocId);

    void compact(Long id, byte[] snapshot);

    ShareCreateResponse createShareLink(Long id);

    void revokeShareLink(Long id);

    ShareStatusResponse shareStatus(Long id);
}
