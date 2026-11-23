package com.zcollab.service.impl;

import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.zcollab.core.store.DocStore;
import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.dto.doc.ImportDocRequest;
import com.zcollab.dto.doc.SearchDocRequest;
import com.zcollab.dto.doc.UpdateDocRequest;
import com.zcollab.entity.Doc;
import com.zcollab.entity.ShareLink;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.ShareLinkMapper;
import com.zcollab.service.DocService;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.DocResponse;
import com.zcollab.vo.doc.DocSearchResponse;
import com.zcollab.vo.doc.DocSummaryResponse;
import com.zcollab.vo.share.ShareCreateResponse;
import com.zcollab.vo.share.ShareStatusResponse;
import com.zcollab.ws.CollabRoomRegistry;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class DocServiceImpl implements DocService {

    private static final int DEFAULT_SEARCH_LIMIT = 20;
    private static final int MAX_SEARCH_LIMIT = 50;
    private static final int MAX_IMPORT_CONTENT_BYTES = 2 * 1024 * 1024;
    private static final String SNIPPET_MARK = "\u0001";
    private static final String TOKEN_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private static final int TOKEN_LENGTH = 22;
    private static final SecureRandom TOKEN_RANDOM = new SecureRandom();

    private final DocMapper docMapper;
    private final ShareLinkMapper shareLinkMapper;
    private final WorkspaceMemberService workspaceMemberService;
    private final DocStore docStore;
    private final CollabRoomRegistry roomRegistry;

    public DocServiceImpl(DocMapper docMapper, ShareLinkMapper shareLinkMapper,
                          WorkspaceMemberService workspaceMemberService,
                          DocStore docStore, CollabRoomRegistry roomRegistry) {
        this.docMapper = docMapper;
        this.shareLinkMapper = shareLinkMapper;
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
    public List<DocSearchResponse> search(SearchDocRequest request) {
        String keyword = request.getKeyword() == null ? "" : request.getKeyword().strip();
        if (keyword.isEmpty()) {
            return List.of();
        }
        int limit = request.getLimit() == null
                ? DEFAULT_SEARCH_LIMIT
                : Math.min(Math.max(request.getLimit(), 1), MAX_SEARCH_LIMIT);
        Long workspaceId = currentWorkspaceId();
        return docMapper.search(workspaceId, keyword, escapeLikeKeyword(keyword), limit).stream()
                .map(row -> new DocSearchResponse(
                        row.getId(),
                        row.getTitle(),
                        buildSnippet(row.getContentText(), keyword),
                        row.getScore() == null ? 0 : row.getScore()))
                .toList();
    }

    @Override
    @Transactional
    public DocResponse create(CreateDocRequest request) {
        Long workspaceId = currentWorkspaceId();
        String title = request.getTitle() == null || request.getTitle().isBlank()
                ? "无标题" : request.getTitle();
        return toResponse(insertDoc(workspaceId, request.getParentDocId(), title));
    }

    @Override
    @Transactional
    public DocResponse importDoc(ImportDocRequest request) {
        String content = request.getContent();
        if (content.getBytes(StandardCharsets.UTF_8).length > MAX_IMPORT_CONTENT_BYTES) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "content 超过 2MB");
        }
        String contentText = request.getContentText() == null ? "" : request.getContentText();

        Long workspaceId = currentWorkspaceId();
        Doc doc = insertDoc(workspaceId, request.getParentId(), request.getTitle());
        docMapper.update(null, new LambdaUpdateWrapper<Doc>()
                .eq(Doc::getId, doc.getId())
                .eq(Doc::getWorkspaceId, workspaceId)
                .isNull(Doc::getDeletedAt)
                .set(Doc::getContent, content)
                .set(Doc::getContentText, contentText));
        // 让 claim-seed 迁移在首次打开时把 content 灌入 Yjs；这里不写 seed_claimed_at。
        return toResponse(requireDoc(doc.getId(), workspaceId));
    }

    private Doc insertDoc(Long workspaceId, Long parentDocId, String title) {
        Doc doc = new Doc();
        doc.setWorkspaceId(workspaceId);
        doc.setParentDocId(parentDocId);
        doc.setSortOrder(docMapper.selectNextSortOrder(workspaceId, parentDocId));
        doc.setTitle(title);
        doc.setContent("");
        doc.setContentText("");
        docMapper.insert(doc);
        return doc;
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
        boolean hasText = request.getText() != null;
        if (hasTitle || hasContent || hasText) {
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
            if (hasText) {
                wrapper.set(Doc::getContentText, request.getText());
            }
            docMapper.update(null, wrapper);
        }
        if (hasTitle) {
            doc.setTitle(request.getTitle());
        }
        if (hasContent) {
            doc.setContent(request.getContent());
        }
        if (hasText) {
            doc.setContentText(request.getText());
        }
        // updated_at 由数据库触发器刷新，重新读取实体才能把新的时间带进响应。
        if (hasTitle || hasContent || hasText) {
            doc = requireDoc(request.getId(), workspaceId);
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
    @Transactional
    public void move(Long id, Long parentId, Long beforeDocId) {
        Long workspaceId = currentWorkspaceId();
        Doc doc = requireDoc(id, workspaceId);
        if (parentId != null) {
            requireDoc(parentId, workspaceId);
            if (docMapper.selectDescendantIds(id, workspaceId).contains(parentId)) {
                String message = parentId.equals(id)
                        ? "不能移动到自身"
                        : "不能移动到自己的子页面下";
                throw new BusinessException(ErrorCode.BAD_REQUEST, message);
            }
        }

        List<Long> siblings = new ArrayList<>(
                docMapper.selectSortedSiblingIds(workspaceId, parentId, id));
        int insertAt = siblings.size();
        if (beforeDocId != null) {
            insertAt = siblings.indexOf(beforeDocId);
            if (insertAt < 0) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "beforeDocId 必须与新父级同级");
            }
        }
        siblings.add(insertAt, id);

        docMapper.update(null, new LambdaUpdateWrapper<Doc>()
                .eq(Doc::getId, doc.getId())
                .eq(Doc::getWorkspaceId, workspaceId)
                .isNull(Doc::getDeletedAt)
                .set(Doc::getParentDocId, parentId));
        for (int i = 0; i < siblings.size(); i += 1) {
            docMapper.updateSortOrder(siblings.get(i), workspaceId, i);
        }
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

    @Override
    public ShareCreateResponse createShareLink(Long id) {
        Doc doc = requireDoc(id, currentWorkspaceId());
        ShareLink active = shareLinkMapper.selectActiveByDocId(doc.getId());
        if (active != null) {
            return toCreateResponse(active);
        }

        ShareLink link = new ShareLink();
        link.setDocId(doc.getId());
        link.setWorkspaceId(doc.getWorkspaceId());
        link.setToken(generateToken());
        link.setCreatedBy(StpUtil.getLoginIdAsLong());
        try {
            shareLinkMapper.insert(link);
        } catch (DuplicateKeyException e) {
            // 并发创建时部分唯一索引只放行一个，其余请求复用胜出的那条链接。
            ShareLink winner = shareLinkMapper.selectActiveByDocId(doc.getId());
            if (winner != null) {
                return toCreateResponse(winner);
            }
            throw e;
        }
        return toCreateResponse(link);
    }

    @Override
    @Transactional
    public void revokeShareLink(Long id) {
        Doc doc = requireDoc(id, currentWorkspaceId());
        shareLinkMapper.revokeActiveByDocId(doc.getId(), doc.getWorkspaceId(), OffsetDateTime.now());
    }

    @Override
    public ShareStatusResponse shareStatus(Long id) {
        Doc doc = requireDoc(id, currentWorkspaceId());
        ShareLink active = shareLinkMapper.selectActiveByDocId(doc.getId());
        return new ShareStatusResponse(active != null, active == null ? null : active.getToken());
    }

    private static ShareCreateResponse toCreateResponse(ShareLink link) {
        return new ShareCreateResponse(link.getToken(), "/s/" + link.getToken());
    }

    static String generateToken() {
        StringBuilder token = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i += 1) {
            token.append(TOKEN_ALPHABET.charAt(TOKEN_RANDOM.nextInt(TOKEN_ALPHABET.length())));
        }
        return token.toString();
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

    /** LIKE 匹配专用：先转义反斜杠，再转义 % 和 _；其他用途仍使用原始关键词。 */
    public static String escapeLikeKeyword(String keyword) {
        return keyword.replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    /** 正文命中时截取前后各 30 个字符，并用 \u0001 包住命中词供前端加粗。 */
    public static String buildSnippet(String contentText, String keyword) {
        String content = contentText == null ? "" : contentText;
        if (keyword == null || keyword.isEmpty()) {
            return content.substring(0, Math.min(60, content.length()));
        }
        int hit = content.indexOf(keyword);
        if (hit < 0) {
            hit = content.toLowerCase(Locale.ROOT).indexOf(keyword.toLowerCase(Locale.ROOT));
        }
        if (hit < 0) {
            return content.substring(0, Math.min(60, content.length()));
        }
        int end = Math.min(content.length(), hit + keyword.length());
        int from = Math.max(0, hit - 30);
        int to = Math.min(content.length(), end + 30);
        return content.substring(from, hit) + SNIPPET_MARK
                + content.substring(hit, end) + SNIPPET_MARK
                + content.substring(end, to);
    }

    private DocResponse toResponse(Doc doc) {
        return new DocResponse(doc.getId(), doc.getParentDocId(), doc.getTitle(),
                doc.getContent(), doc.getContentText() == null ? "" : doc.getContentText(), doc.getUpdatedAt());
    }
}
