package com.zcollab.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.entity.Doc;
import com.zcollab.entity.ShareLink;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.ShareLinkMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.share.PublicShareResponse;
import com.zcollab.vo.share.ShareCreateResponse;
import com.zcollab.vo.share.ShareStatusResponse;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

class ShareServiceImplTest {

    @BeforeEach
    void setUp() {
        SaTokenContextMockUtil.setMockContext();
    }

    @AfterEach
    void tearDown() {
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void tokenIsRandom22CharacterBase62() {
        Set<String> tokens = new HashSet<>();
        for (int i = 0; i < 1000; i += 1) {
            String token = DocServiceImpl.generateToken();
            assertEquals(22, token.length());
            assertTrue(token.matches("[0-9A-Za-z]{22}"), token);
            tokens.add(token);
        }
        assertEquals(1000, tokens.size());
    }

    @Test
    void createReusesActiveLinkWithoutInserting() {
        ShareLink active = link(11L, 1L, "existing-token");
        AtomicInteger inserts = new AtomicInteger();
        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectActiveByDocId")) return active;
            if (method.getName().equals("insert")) {
                inserts.incrementAndGet();
                return 1;
            }
            throw new UnsupportedOperationException(method.getName());
        });

        ShareCreateResponse result = docService(doc(11L, 1L), shareLinks).createShareLink(11L);

        assertEquals("existing-token", result.token());
        assertEquals("/s/existing-token", result.path());
        assertEquals(0, inserts.get());
    }

    @Test
    void createGeneratesFreshTokenWhenNoActiveLink() {
        StpUtil.login(7L);
        AtomicReference<ShareLink> inserted = new AtomicReference<>();
        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectActiveByDocId")) return null;
            if (method.getName().equals("insert")) {
                inserted.set((ShareLink) args[0]);
                return 1;
            }
            throw new UnsupportedOperationException(method.getName());
        });

        ShareCreateResponse result = docService(doc(11L, 1L), shareLinks).createShareLink(11L);

        assertNotNull(inserted.get());
        assertEquals(result.token(), inserted.get().getToken());
        assertEquals(22, result.token().length());
        assertEquals(1L, inserted.get().getWorkspaceId());
        assertEquals(7L, inserted.get().getCreatedBy());
    }

    @Test
    void createFallsBackToWinnerAfterUniqueKeyConflict() {
        StpUtil.login(7L);
        ShareLink winner = link(11L, 1L, "winner-token");
        AtomicInteger selects = new AtomicInteger();
        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectActiveByDocId")) {
                return selects.getAndIncrement() == 0 ? null : winner;
            }
            if (method.getName().equals("insert")) {
                throw new DuplicateKeyException("duplicate active link");
            }
            throw new UnsupportedOperationException(method.getName());
        });

        ShareCreateResponse result = docService(doc(11L, 1L), shareLinks).createShareLink(11L);

        assertEquals("winner-token", result.token());
    }

    @Test
    void revokeStampsActiveLinkAndStatusReflectsIt() {
        ShareLink active = link(11L, 1L, "old-token");
        AtomicReference<OffsetDateTime> revokedAt = new AtomicReference<>();
        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectActiveByDocId")) return active;
            if (method.getName().equals("revokeActiveByDocId")) {
                revokedAt.set((OffsetDateTime) args[2]);
                return 1;
            }
            throw new UnsupportedOperationException(method.getName());
        });
        DocServiceImpl service = docService(doc(11L, 1L), shareLinks);

        ShareStatusResponse before = service.shareStatus(11L);
        assertTrue(before.shared());
        assertEquals("old-token", before.token());

        service.revokeShareLink(11L);
        assertNotNull(revokedAt.get());
    }

    @Test
    void statusIsEmptyAfterRevocation() {
        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectActiveByDocId")) return null;
            throw new UnsupportedOperationException(method.getName());
        });

        ShareStatusResponse status = docService(doc(11L, 1L), shareLinks).shareStatus(11L);

        assertEquals(new ShareStatusResponse(false, null), status);
    }

    @Test
    void publicShareReturnsOnlyTitleContentAndUpdatedAt() {
        Doc doc = doc(11L, 1L);
        doc.setTitle("公开标题");
        doc.setContent("{\"type\":\"doc\"}");
        doc.setUpdatedAt(OffsetDateTime.parse("2026-11-21T10:00:00Z"));
        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectActiveByToken")) return link(11L, 1L, "good");
            throw new UnsupportedOperationException(method.getName());
        });

        PublicShareResponse response = publicService(shareLinks, doc).getSharedDoc("good");

        assertEquals("公开标题", response.title());
        assertEquals("{\"type\":\"doc\"}", response.content());
        assertEquals("2026-11-21T10:00:00Z", response.updatedAt());
    }

    @Test
    void publicShareRejectsRevokedSoftDeletedAndForeignWorkspaceDocs() {
        Doc doc = doc(11L, 1L);
        ShareLink active = link(11L, 1L, "good");

        ShareLink revoked = link(11L, 1L, "good");
        revoked.setRevokedAt(OffsetDateTime.now());
        assertNotFound(revoked, doc);

        Doc deleted = doc(11L, 1L);
        deleted.setDeletedAt(OffsetDateTime.now());
        assertNotFound(active, deleted);

        assertNotFound(active, doc(11L, 2L));
        assertNotFound(null, doc);

        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> null);
        PublicShareServiceImpl service = new PublicShareServiceImpl(shareLinks, proxy(DocMapper.class, (p, m, a) -> null));
        assertNotFound(service, " ");
    }

    private static void assertNotFound(ShareLink link, Doc doc) {
        ShareLinkMapper shareLinks = proxy(ShareLinkMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectActiveByToken")) return link;
            throw new UnsupportedOperationException(method.getName());
        });
        assertNotFound(publicService(shareLinks, doc), "good");
    }

    private static void assertNotFound(PublicShareServiceImpl service, String token) {
        BusinessException error = assertThrows(BusinessException.class, () -> service.getSharedDoc(token));
        assertSame(ErrorCode.NOT_FOUND, error.getErrorCode());
    }

    private static PublicShareServiceImpl publicService(ShareLinkMapper shareLinks, Doc doc) {
        DocMapper docs = proxy(DocMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectById")) return doc;
            throw new UnsupportedOperationException(method.getName());
        });
        return new PublicShareServiceImpl(shareLinks, docs);
    }

    private static DocServiceImpl docService(Doc doc, ShareLinkMapper shareLinks) {
        DocMapper docs = proxy(DocMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectById")) return doc;
            throw new UnsupportedOperationException(method.getName());
        });
        WorkspaceMemberService members = proxy(WorkspaceMemberService.class, (proxy, method, args) ->
                new WorkspaceMembership(1L, "owner"));
        return new DocServiceImpl(docs, shareLinks, members, null, null);
    }

    private static Doc doc(long id, long workspaceId) {
        Doc doc = new Doc();
        doc.setId(id);
        doc.setWorkspaceId(workspaceId);
        doc.setTitle("标题");
        doc.setContent("");
        return doc;
    }

    private static ShareLink link(long docId, long workspaceId, String token) {
        ShareLink link = new ShareLink();
        link.setId(100L);
        link.setDocId(docId);
        link.setWorkspaceId(workspaceId);
        link.setToken(token);
        return link;
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }
}
