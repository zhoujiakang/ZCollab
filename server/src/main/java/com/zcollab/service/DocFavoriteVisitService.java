package com.zcollab.service;

import com.zcollab.vo.doc.DocFavoriteResponse;
import com.zcollab.vo.doc.DocRecentResponse;

import java.util.List;

public interface DocFavoriteVisitService {

    boolean toggleFavorite(Long docId);

    List<DocFavoriteResponse> listFavorites();

    void recordVisit(Long docId);

    List<DocRecentResponse> listRecent();
}
