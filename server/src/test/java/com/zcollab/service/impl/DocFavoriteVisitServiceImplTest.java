package com.zcollab.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.entity.Doc;
import com.zcollab.entity.DocFavorite;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocFavoriteMapper;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.DocVisitMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.DocFavoriteResponse;
import com.zcollab.vo.doc.DocFavoriteRow;
import com.zcollab.vo.doc.DocRecentResponse;
import com.zcollab.vo.doc.DocVisitRow;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

class DocFavoriteVisitServiceImplTest {

    private static final long USER_ID = 42L;
    private static final long WORKSPACE_ID = 1L;

    @BeforeEach
    void setUp() {
        SaTokenContextMockUtil.setMockContext();
        StpUtil.login(USER_ID);
    }

    @AfterEach
    void tearDown() {
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void toggleFavoriteInsertsThenDeletesAndListUsesCurrentWorkspace() {
        AtomicReference<DocFavorite> stored = new AtomicReference<>();
        DocFavoriteMapper favorites = proxy(DocFavoriteMapper.class, (proxy, method, args) -> switch (method.getName()) {
            case "selectByUserAndDoc" -> stored.get();
            case "insertFavorite" -> {
                DocFavorite row = new DocFavorite();
                row.setId((Long) args[0]);
                row.setWorkspaceId((Long) args[1]);
                row.setUserId((Long) args[2]);
                row.setDocId((Long) args[3]);
                stored.set(row);
                yield 1;
            }
            case "deleteFavorite" -> {
                boolean removed = stored.get() != null && stored.get().getId().equals(args[0]);
                if (removed) stored.set(null);
                yield removed ? 1 : 0;
            }
            case "selectFavorites" -> {
                assertEquals(USER_ID, args[0]);
                assertEquals(WORKSPACE_ID, args[1]);
                assertEquals(50, args[2]);
                if (stored.get() == null || !stored.get().getWorkspaceId().equals(args[1])) yield List.of();
                DocFavoriteRow row = new DocFavoriteRow();
                row.setId(stored.get().getDocId());
                row.setTitle("A");
                yield List.of(row);
            }
            default -> throw new UnsupportedOperationException(method.getName());
        });
        DocFavoriteVisitServiceImpl service = service(doc(7L, WORKSPACE_ID), favorites, unusedVisitMapper(), members());

        assertTrue(service.toggleFavorite(7L));
        assertNotNull(stored.get());
        List<DocFavoriteResponse> listed = service.listFavorites();
        assertEquals(1, listed.size());
        assertEquals(7L, listed.get(0).id());
        assertEquals("A", listed.get(0).title());

        assertFalse(service.toggleFavorite(7L));
        assertEquals(null, stored.get());
        assertTrue(service.listFavorites().isEmpty());
    }

    @Test
    void recordVisitUpsertsWithCurrentUserAndWorkspace() {
        AtomicReference<Object[]> captured = new AtomicReference<>();
        DocVisitMapper visits = proxy(DocVisitMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("upsertVisit")) {
                captured.set(args);
                return 1;
            }
            throw new UnsupportedOperationException(method.getName());
        });

        service(doc(9L, WORKSPACE_ID), unusedFavoriteMapper(), visits, members()).recordVisit(9L);

        assertNotNull(captured.get());
        assertNotNull(captured.get()[0]);
        assertEquals(WORKSPACE_ID, captured.get()[1]);
        assertEquals(USER_ID, captured.get()[2]);
        assertEquals(9L, captured.get()[3]);
    }

    @Test
    void listRecentMapsServerRowIncludingVisitedAt() {
        OffsetDateTime visitedAt = OffsetDateTime.now().minusMinutes(2);
        DocVisitMapper visits = proxy(DocVisitMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectRecent")) {
                assertEquals(USER_ID, args[0]);
                assertEquals(WORKSPACE_ID, args[1]);
                assertEquals(10, args[2]);
                DocVisitRow row = new DocVisitRow();
                row.setId(8L);
                row.setTitle("C");
                row.setVisitedAt(visitedAt);
                return List.of(row);
            }
            throw new UnsupportedOperationException(method.getName());
        });

        List<DocRecentResponse> recent = service(doc(8L, WORKSPACE_ID), unusedFavoriteMapper(), visits, members()).listRecent();

        assertEquals(1, recent.size());
        assertEquals(8L, recent.get(0).id());
        assertEquals("C", recent.get(0).title());
        assertEquals(visitedAt, recent.get(0).visitedAt());
    }

    @Test
    void toggleFavoriteRejectsDocOutsideCurrentWorkspace() {
        DocFavoriteMapper favorites = proxy(DocFavoriteMapper.class,
                (proxy, method, args) -> {
                    throw new UnsupportedOperationException(method.getName());
                });
        DocFavoriteVisitServiceImpl service = service(doc(7L, 2L), favorites, unusedVisitMapper(), members());

        BusinessException error = assertThrows(BusinessException.class, () -> service.toggleFavorite(7L));

        assertEquals(ErrorCode.NOT_FOUND, error.getErrorCode());
    }

    private static DocFavoriteVisitServiceImpl service(Doc doc,
                                                       DocFavoriteMapper favorites,
                                                       DocVisitMapper visits,
                                                       WorkspaceMemberService members) {
        DocMapper docs = proxy(DocMapper.class, (proxy, method, args) -> {
            if (method.getName().equals("selectById")) return doc;
            throw new UnsupportedOperationException(method.getName());
        });
        return new DocFavoriteVisitServiceImpl(docs, favorites, visits, members);
    }

    private static Doc doc(long id, long workspaceId) {
        Doc doc = new Doc();
        doc.setId(id);
        doc.setWorkspaceId(workspaceId);
        return doc;
    }

    private static WorkspaceMemberService members() {
        return proxy(WorkspaceMemberService.class, (proxy, method, args) -> {
            if (method.getName().equals("requireCurrentMembership")) {
                return new WorkspaceMembership(WORKSPACE_ID, "owner");
            }
            throw new UnsupportedOperationException(method.getName());
        });
    }

    private static DocFavoriteMapper unusedFavoriteMapper() {
        return proxy(DocFavoriteMapper.class, (proxy, method, args) -> {
            throw new UnsupportedOperationException(method.getName());
        });
    }

    private static DocVisitMapper unusedVisitMapper() {
        return proxy(DocVisitMapper.class, (proxy, method, args) -> {
            throw new UnsupportedOperationException(method.getName());
        });
    }

    private static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return type.cast(Proxy.newProxyInstance(
                DocFavoriteVisitServiceImplTest.class.getClassLoader(), new Class<?>[]{type}, handler));
    }
}
