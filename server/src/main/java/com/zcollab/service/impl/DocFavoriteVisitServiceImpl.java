package com.zcollab.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.zcollab.entity.Doc;
import com.zcollab.entity.DocFavorite;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocFavoriteMapper;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.DocVisitMapper;
import com.zcollab.service.DocFavoriteVisitService;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.DocFavoriteResponse;
import com.zcollab.vo.doc.DocRecentResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DocFavoriteVisitServiceImpl implements DocFavoriteVisitService {

    private static final int FAVORITE_LIMIT = 50;
    private static final int RECENT_LIMIT = 10;

    private final DocMapper docMapper;
    private final DocFavoriteMapper favoriteMapper;
    private final DocVisitMapper visitMapper;
    private final WorkspaceMemberService workspaceMemberService;

    public DocFavoriteVisitServiceImpl(DocMapper docMapper,
                                       DocFavoriteMapper favoriteMapper,
                                       DocVisitMapper visitMapper,
                                       WorkspaceMemberService workspaceMemberService) {
        this.docMapper = docMapper;
        this.favoriteMapper = favoriteMapper;
        this.visitMapper = visitMapper;
        this.workspaceMemberService = workspaceMemberService;
    }

    @Override
    public boolean toggleFavorite(Long docId) {
        long userId = requireUserId();
        Long workspaceId = currentWorkspaceId();
        requireDoc(docId, workspaceId);

        DocFavorite existing = favoriteMapper.selectByUserAndDoc(userId, docId);
        if (existing != null) {
            favoriteMapper.deleteFavorite(existing.getId());
            return false;
        }
        try {
            favoriteMapper.insertFavorite(IdWorker.getId(), workspaceId, userId, docId);
        } catch (DuplicateKeyException e) {
            return true;
        }
        return true;
    }

    @Override
    public List<DocFavoriteResponse> listFavorites() {
        long userId = requireUserId();
        Long workspaceId = currentWorkspaceId();
        return favoriteMapper.selectFavorites(userId, workspaceId, FAVORITE_LIMIT).stream()
                .map(row -> new DocFavoriteResponse(row.getId(), row.getTitle()))
                .toList();
    }

    @Override
    public void recordVisit(Long docId) {
        long userId = requireUserId();
        Long workspaceId = currentWorkspaceId();
        requireDoc(docId, workspaceId);
        visitMapper.upsertVisit(IdWorker.getId(), workspaceId, userId, docId);
    }

    @Override
    public List<DocRecentResponse> listRecent() {
        long userId = requireUserId();
        Long workspaceId = currentWorkspaceId();
        return visitMapper.selectRecent(userId, workspaceId, RECENT_LIMIT).stream()
                .map(row -> new DocRecentResponse(row.getId(), row.getTitle(), row.getVisitedAt()))
                .toList();
    }

    private long requireUserId() {
        StpUtil.checkLogin();
        return StpUtil.getLoginIdAsLong();
    }

    private Long currentWorkspaceId() {
        return workspaceMemberService.requireCurrentMembership().workspaceId();
    }

    private void requireDoc(Long id, Long workspaceId) {
        Doc doc = docMapper.selectById(id);
        if (doc == null || !workspaceId.equals(doc.getWorkspaceId()) || doc.getDeletedAt() != null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
    }
}
