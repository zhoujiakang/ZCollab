package com.zcollab.service;

import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.dto.doc.UpdateDocRequest;
import com.zcollab.vo.doc.DocResponse;
import com.zcollab.vo.doc.DocSummaryResponse;

import java.util.List;

public interface DocService {

    List<DocSummaryResponse> list();

    DocResponse create(CreateDocRequest request);

    DocResponse get(Long id);

    boolean claimSeed(Long id);

    DocResponse update(UpdateDocRequest request);

    void delete(Long id);

    void compact(Long id, byte[] snapshot);
}
