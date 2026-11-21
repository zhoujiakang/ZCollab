package com.zcollab.service.impl;

import com.zcollab.entity.Doc;
import com.zcollab.entity.ShareLink;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.ShareLinkMapper;
import com.zcollab.service.PublicShareService;
import com.zcollab.vo.share.PublicShareResponse;
import org.springframework.stereotype.Service;

/** 只按 token 查询，不读取会话、不调用 StpUtil。 */
@Service
public class PublicShareServiceImpl implements PublicShareService {

    private final ShareLinkMapper shareLinkMapper;
    private final DocMapper docMapper;

    public PublicShareServiceImpl(ShareLinkMapper shareLinkMapper, DocMapper docMapper) {
        this.shareLinkMapper = shareLinkMapper;
        this.docMapper = docMapper;
    }

    @Override
    public PublicShareResponse getSharedDoc(String token) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        ShareLink link = shareLinkMapper.selectActiveByToken(token);
        if (link == null || link.getRevokedAt() != null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        Doc doc = docMapper.selectById(link.getDocId());
        if (doc == null || !link.getWorkspaceId().equals(doc.getWorkspaceId()) || doc.getDeletedAt() != null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        String updatedAt = doc.getUpdatedAt() == null ? null : doc.getUpdatedAt().toInstant().toString();
        return new PublicShareResponse(doc.getTitle(), doc.getContent() == null ? "" : doc.getContent(), updatedAt);
    }
}
