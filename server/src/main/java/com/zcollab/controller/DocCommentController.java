package com.zcollab.controller;

import cn.dev33.satoken.annotation.SaCheckLogin;
import cn.dev33.satoken.stp.StpUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.zcollab.common.ApiResponse;
import com.zcollab.dto.doc.CreateCommentRequest;
import com.zcollab.dto.doc.DeleteCommentRequest;
import com.zcollab.dto.doc.ListCommentsRequest;
import com.zcollab.dto.doc.ResolveCommentRequest;
import com.zcollab.entity.Doc;
import com.zcollab.entity.DocComment;
import com.zcollab.entity.User;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocCommentMapper;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.UserMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.CommentAuthorResponse;
import com.zcollab.vo.doc.DocCommentResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/doc/comment")
@SaCheckLogin
public class DocCommentController {

    private final DocMapper docMapper;
    private final DocCommentMapper commentMapper;
    private final UserMapper userMapper;
    private final WorkspaceMemberService workspaceMemberService;

    public DocCommentController(DocMapper docMapper, DocCommentMapper commentMapper,
                                UserMapper userMapper, WorkspaceMemberService workspaceMemberService) {
        this.docMapper = docMapper;
        this.commentMapper = commentMapper;
        this.userMapper = userMapper;
        this.workspaceMemberService = workspaceMemberService;
    }

    @PostMapping("/list")
    public ApiResponse<List<DocCommentResponse>> list(@RequestBody @Valid ListCommentsRequest request) {
        Long workspaceId = currentWorkspaceId();
        requireDoc(request.getDocId(), workspaceId);

        List<DocComment> comments = commentMapper.selectList(new LambdaQueryWrapper<DocComment>()
                .eq(DocComment::getWorkspaceId, workspaceId)
                .eq(DocComment::getDocId, request.getDocId())
                .isNull(DocComment::getDeletedAt)
                .orderByAsc(DocComment::getCreatedAt)
                .orderByAsc(DocComment::getId));

        Map<Long, CommentAuthorResponse> authors = loadAuthors(comments);
        boolean isOwner = isOwner();
        long currentUserId = StpUtil.getLoginIdAsLong();
        Map<Long, List<DocCommentResponse>> repliesByParent = new HashMap<>();
        for (DocComment comment : comments) {
            if (comment.getParentId() == null) continue;
            repliesByParent.computeIfAbsent(comment.getParentId(), key -> new ArrayList<>())
                    .add(toResponse(comment, authors, isOwner, currentUserId, List.of()));
        }

        List<DocCommentResponse> result = new ArrayList<>();
        for (DocComment comment : comments) {
            if (comment.getParentId() != null) continue;
            result.add(toResponse(comment, authors, isOwner, currentUserId,
                    repliesByParent.getOrDefault(comment.getId(), List.of())));
        }
        return ApiResponse.ok(result);
    }

    @PostMapping("/create")
    public ApiResponse<DocCommentResponse> create(@RequestBody @Valid CreateCommentRequest request) {
        Long workspaceId = currentWorkspaceId();
        requireDoc(request.getDocId(), workspaceId);

        if (request.getParentId() != null) {
            DocComment parent = commentMapper.selectById(request.getParentId());
            if (parent == null || !workspaceId.equals(parent.getWorkspaceId())
                    || !request.getDocId().equals(parent.getDocId()) || parent.getDeletedAt() != null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "要回复的评论不存在或不属于当前文档");
            }
            if (parent.getParentId() != null) {
                throw new BusinessException(ErrorCode.BAD_REQUEST, "只允许一层回复，不能回复已有回复");
            }
        }

        long userId = StpUtil.getLoginIdAsLong();
        OffsetDateTime now = OffsetDateTime.now();
        DocComment comment = new DocComment();
        comment.setId(IdWorker.getId());
        comment.setWorkspaceId(workspaceId);
        comment.setDocId(request.getDocId());
        comment.setUserId(userId);
        comment.setParentId(request.getParentId());
        comment.setQuote(request.getQuote());
        comment.setAnchorFrom(request.getAnchorFrom());
        comment.setAnchorTo(request.getAnchorTo());
        comment.setBody(request.getBody());
        comment.setCreatedAt(now);
        comment.setUpdatedAt(now);
        commentMapper.insert(comment);

        Map<Long, CommentAuthorResponse> authors = Map.of(userId, authorOf(userId));
        return ApiResponse.ok(toResponse(comment, authors, false, userId, List.of()));
    }

    @PostMapping("/resolve")
    public ApiResponse<Void> resolve(@RequestBody @Valid ResolveCommentRequest request) {
        Long workspaceId = currentWorkspaceId();
        DocComment comment = requireComment(request.getId(), workspaceId);
        requireDoc(comment.getDocId(), workspaceId);
        if (comment.getParentId() != null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "只有一级评论可以解决或重新打开");
        }

        long userId = StpUtil.getLoginIdAsLong();
        OffsetDateTime now = OffsetDateTime.now();
        commentMapper.update(null, new LambdaUpdateWrapper<DocComment>()
                .eq(DocComment::getId, comment.getId())
                .eq(DocComment::getWorkspaceId, workspaceId)
                .isNull(DocComment::getDeletedAt)
                .set(DocComment::getResolvedAt, request.getResolved() ? now : null)
                .set(DocComment::getResolvedBy, request.getResolved() ? userId : null)
                .set(DocComment::getUpdatedAt, now));
        return ApiResponse.ok();
    }

    @PostMapping("/delete")
    public ApiResponse<Void> delete(@RequestBody @Valid DeleteCommentRequest request) {
        Long workspaceId = currentWorkspaceId();
        DocComment comment = requireComment(request.getId(), workspaceId);
        requireDoc(comment.getDocId(), workspaceId);

        long userId = StpUtil.getLoginIdAsLong();
        if (!isOwner() && !Objects.equals(comment.getUserId(), userId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "只能删除自己的评论，工作区 owner 可删除任意评论");
        }

        OffsetDateTime now = OffsetDateTime.now();
        commentMapper.update(null, new LambdaUpdateWrapper<DocComment>()
                .eq(DocComment::getId, comment.getId())
                .eq(DocComment::getWorkspaceId, workspaceId)
                .isNull(DocComment::getDeletedAt)
                .set(DocComment::getDeletedAt, now)
                .set(DocComment::getUpdatedAt, now));
        if (comment.getParentId() == null) {
            commentMapper.update(null, new LambdaUpdateWrapper<DocComment>()
                    .eq(DocComment::getWorkspaceId, workspaceId)
                    .eq(DocComment::getParentId, comment.getId())
                    .isNull(DocComment::getDeletedAt)
                    .set(DocComment::getDeletedAt, now)
                    .set(DocComment::getUpdatedAt, now));
        }
        return ApiResponse.ok();
    }

    private Long currentWorkspaceId() {
        return workspaceMemberService.requireCurrentMembership().workspaceId();
    }

    private boolean isOwner() {
        return "owner".equals(workspaceMemberService.requireCurrentMembership().role());
    }

    private void requireDoc(Long docId, Long workspaceId) {
        Doc doc = docMapper.selectOne(new LambdaQueryWrapper<Doc>()
                .eq(Doc::getId, docId)
                .eq(Doc::getWorkspaceId, workspaceId)
                .isNull(Doc::getDeletedAt));
        if (doc == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "文档不存在");
        }
    }

    private DocComment requireComment(Long id, Long workspaceId) {
        DocComment comment = commentMapper.selectById(id);
        if (comment == null || !workspaceId.equals(comment.getWorkspaceId()) || comment.getDeletedAt() != null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "评论不存在");
        }
        return comment;
    }

    private Map<Long, CommentAuthorResponse> loadAuthors(List<DocComment> comments) {
        if (comments.isEmpty()) return Map.of();
        Set<Long> userIds = comments.stream().map(DocComment::getUserId).collect(Collectors.toSet());
        Map<Long, User> users = userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a));
        Map<Long, CommentAuthorResponse> authors = new HashMap<>();
        for (Long userId : userIds) {
            authors.put(userId, toAuthor(users.get(userId), userId));
        }
        return authors;
    }

    private CommentAuthorResponse authorOf(long userId) {
        List<User> users = userMapper.selectBatchIds(List.of(userId));
        return toAuthor(users.isEmpty() ? null : users.get(0), userId);
    }

    private CommentAuthorResponse toAuthor(User user, Long userId) {
        if (user == null) return new CommentAuthorResponse(userId, "未知用户", null);
        return new CommentAuthorResponse(user.getId(), user.getName(), user.getAvatarUrl());
    }

    private DocCommentResponse toResponse(DocComment comment, Map<Long, CommentAuthorResponse> authors,
                                          boolean isOwner, long currentUserId, List<DocCommentResponse> replies) {
        CommentAuthorResponse author = authors.get(comment.getUserId());
        if (author == null) author = new CommentAuthorResponse(comment.getUserId(), "未知用户", null);
        boolean canDelete = isOwner || Objects.equals(comment.getUserId(), currentUserId);
        return new DocCommentResponse(comment.getId(), comment.getParentId(), comment.getQuote(),
                comment.getBody(), author, comment.getCreatedAt(), comment.getResolvedAt(), canDelete, replies);
    }
}
