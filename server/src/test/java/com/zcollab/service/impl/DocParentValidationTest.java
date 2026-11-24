package com.zcollab.service.impl;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.MybatisMapperBuilderAssistant;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.zcollab.dto.doc.CreateDocRequest;
import com.zcollab.dto.doc.ImportDocRequest;
import com.zcollab.entity.Doc;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.DocResponse;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.time.OffsetDateTime;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class DocParentValidationTest {
    static {
        TableInfoHelper.initTableInfo(
                new MybatisMapperBuilderAssistant(new MybatisConfiguration(), ""), Doc.class);
    }

    @Test
    void createAndImportRejectMissingDeletedAndForeignParentsBeforeWriting() {
        Doc foreign = parent(2L);
        Doc deleted = parent(1L);
        deleted.setDeletedAt(OffsetDateTime.now());
        for (boolean importing : new boolean[]{false, true}) {
            for (Doc candidate : new Doc[]{null, foreign, deleted}) {
                Harness h = new Harness(candidate);
                BusinessException error = assertThrows(BusinessException.class,
                        () -> h.create(importing, 99L));
                assertEquals(ErrorCode.NOT_FOUND, error.getErrorCode());
                assertEquals(0, h.writes.get());
            }
        }
    }

    @Test
    void createAndImportAllowRootOrLiveParentInCurrentWorkspace() {
        for (boolean importing : new boolean[]{false, true}) {
            for (Long parentId : new Long[]{null, 99L}) {
                Harness h = new Harness(parent(1L));
                DocResponse doc = h.create(importing, parentId);
                assertEquals(parentId, doc.parentDocId());
                assertEquals(1L, h.inserted.getWorkspaceId());
                assertTrue(h.writes.get() > 0);
            }
        }
    }

    private static Doc parent(long workspaceId) {
        Doc parent = new Doc();
        parent.setId(99L);
        parent.setWorkspaceId(workspaceId);
        return parent;
    }

    private static class Harness {
        final AtomicInteger writes = new AtomicInteger();
        Doc inserted;
        final DocServiceImpl service;

        Harness(Doc parent) {
            DocMapper mapper = (DocMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                    new Class<?>[]{DocMapper.class}, (proxy, method, args) -> switch (method.getName()) {
                        case "selectById" -> Long.valueOf(99).equals(args[0]) ? parent : inserted;
                        case "selectNextSortOrder" -> 0;
                        case "insert" -> {
                            writes.incrementAndGet(); inserted = (Doc) args[0]; inserted.setId(100L); yield 1;
                        }
                        case "update" -> { writes.incrementAndGet(); yield 1; }
                        default -> throw new UnsupportedOperationException(method.getName());
                    });
            WorkspaceMemberService members = (WorkspaceMemberService) Proxy.newProxyInstance(
                    getClass().getClassLoader(), new Class<?>[]{WorkspaceMemberService.class},
                    (proxy, method, args) -> new WorkspaceMembership(1L, "member"));
            service = new DocServiceImpl(mapper, null, members, null, null);
        }

        DocResponse create(boolean importing, Long parentId) {
            if (importing) {
                ImportDocRequest request = new ImportDocRequest();
                request.setTitle("import"); request.setContent("{}"); request.setParentId(parentId);
                return service.importDoc(request);
            }
            CreateDocRequest request = new CreateDocRequest();
            request.setTitle("create"); request.setParentDocId(parentId);
            return service.create(request);
        }
    }
}
