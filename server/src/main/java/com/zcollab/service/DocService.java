package com.zcollab.service;

import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.core.store.DocState;
import com.zcollab.dto.doc.ImportDocRequest;
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

    DocResponse importDoc(ImportDocRequest request);

    DocResponse get(Long id);

    boolean claimSeed(Long id);

    DocResponse update(UpdateDocRequest request);

    void delete(Long id);

    void move(Long id, Long parentId, Long beforeDocId);

    DocState prepareCompact(Long id);

    void compact(Long id, byte[] snapshot, String version);

    ShareCreateResponse createShareLink(Long id);

    void revokeShareLink(Long id);

    ShareStatusResponse shareStatus(Long id);
}
