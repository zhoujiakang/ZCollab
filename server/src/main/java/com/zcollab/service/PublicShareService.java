package com.zcollab.service;

import com.zcollab.vo.share.PublicShareResponse;

public interface PublicShareService {

    PublicShareResponse getSharedDoc(String token);
}
