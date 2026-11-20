package com.zcollab.service.impl;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.zcollab.core.store.DocStore;
import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.dto.doc.UpdateDocRequest;
import com.zcollab.entity.Doc;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocMapper;
import com.zcollab.service.DocService;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.DocResponse;
import com.zcollab.vo.doc.DocSummaryResponse;
import com.zcollab.ws.CollabRoomRegistry;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
public class DocServiceImpl implements DocService {

    private final DocMapper docMapper;
    private final WorkspaceMemberService workspaceMemberService;
    private final DocStore docStore;
    private final CollabRoomRegistry roomRegistry;

    public DocServiceImpl(DocMapper docMapper, WorkspaceMemberService workspaceMemberService,
                          DocStore docStore, CollabRoomRegistry roomRegistry) {
        this.docMapper = docMapper;
        this.workspaceMemberService = workspaceMemberService;
        this.docStore = docStore;
        this.roomRegistry = roomRegistry;
    }

    @Override
    public List<DocSummaryResponse> list() {
        Long workspaceId = currentWorkspaceId();
        return docMapper.selectByWorkspace(workspaceId).stream()
                .map(row -> new DocSummaryResponse(row.getId(), row.getParentDocId(), row.getTitle()))
                .toList();
    }

    @Override
    @Transactional
    public DocResponse create(CreateDocRequest request) {
        Long workspaceId = currentWorkspaceId();
        String title = request.getTitle() == null || request.getTitle().isBlank()
                ? "无标题" : request.getTitle();

        Doc doc = new Doc();
        doc.setWorkspaceId(workspaceId);
        doc.setParentDocId(request.getParentDocId());
        doc.setTitle(title);
        doc.setContent("");
        docMapper.insert(doc);
        return toResponse(doc);
    }

    @Override
    public DocResponse get(Long id) {
        return toResponse(requireDoc(id, currentWorkspaceId()));
    }

    @Override
    public boolean claimSeed(Long id) {
        requireDoc(id, currentWorkspaceId());
        return docMapper.claimSeed(id) > 0;
    }

    @Override
    @Transactional
    public DocResponse update(UpdateDocRequest request) {
        Long workspaceId = currentWorkspaceId();
        Doc doc = requireDoc(request.getId(), workspaceId);

        boolean hasTitle = request.getTitle() != null;
        boolean hasContent = request.getContent() != null;
        if (hasTitle || hasContent) {
            LambdaUpdateWrapper<Doc> wrapper = new LambdaUpdateWrapper<Doc>()
                    .eq(Doc::getId, doc.getId())
                    .eq(Doc::getWorkspaceId, workspaceId)
                    .isNull(Doc::getDeletedAt);
            if (hasTitle) {
                wrapper.set(Doc::getTitle, request.getTitle());
            }
            if (hasContent) {
                wrapper.set(Doc::getContent, request.getContent());
            }
            docMapper.update(null, wrapper);
        }
        if (hasTitle) {
            doc.setTitle(request.getTitle());
        }
        if (hasContent) {
            doc.setContent(request.getContent());
        }
        return toResponse(doc);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Long workspaceId = currentWorkspaceId();
        requireDoc(id, workspaceId);
        List<Long> ids = docMapper.selectDescendantIds(id, workspaceId);
        if (ids.isEmpty()) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        docMapper.update(null, new LambdaUpdateWrapper<Doc>()
                .in(Doc::getId, ids)
                .eq(Doc::getWorkspaceId, workspaceId)
                .isNull(Doc::getDeletedAt)
                .set(Doc::getDeletedAt, OffsetDateTime.now()));
    }

    @Override
    public void compact(Long id, byte[] snapshot) {
        requireDoc(id, currentWorkspaceId());
        // 两人以上时，别人的 update 可能落在快照算完之后、事务提交之前被连带删掉。
        if (roomRegistry.size(id) > 1) {
            throw new BusinessException(ErrorCode.CONFLICT);
        }
        docStore.saveSnapshot(id, snapshot);
    }

    private Long currentWorkspaceId() {
        return workspaceMemberService.requireCurrentMembership().workspaceId();
    }

    private Doc requireDoc(Long id, Long workspaceId) {
        Doc doc = docMapper.selectById(id);
        if (doc == null || !workspaceId.equals(doc.getWorkspaceId()) || doc.getDeletedAt() != null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return doc;
    }

    private DocResponse toResponse(Doc doc) {
        return new DocResponse(doc.getId(), doc.getParentDocId(), doc.getTitle(), doc.getContent());
    }
}
