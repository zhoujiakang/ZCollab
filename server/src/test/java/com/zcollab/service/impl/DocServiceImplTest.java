package com.zcollab.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.MybatisMapperBuilderAssistant;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.zcollab.dto.doc.SearchDocRequest;
import com.zcollab.entity.Doc;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.DocSearchResponse;
import com.zcollab.vo.doc.DocSearchRow;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

class DocServiceImplTest {

    private static final String MARK = "\u0001";

    static {
        TableInfoHelper.initTableInfo(
                new MybatisMapperBuilderAssistant(new MybatisConfiguration(), ""), Doc.class);
    }

    @Test
    void marksHitWithThirtyCharactersAround() {
        String before = "a".repeat(40);
        String after = "b".repeat(50);
        String content = before + "协同编辑" + after;

        String snippet = DocServiceImpl.buildSnippet(content, "协同");

        assertEquals(before.substring(10) + MARK + "协同" + MARK + "编辑" + after.substring(0, 28), snippet);
    }

    @Test
    void titleOnlyHitUsesStartOfContent() {
        assertEquals("协同编辑", DocServiceImpl.buildSnippet("协同编辑", "只出现在标题"));
    }

    @Test
    void ignoringCaseWhenLocatingHit() {
        assertEquals("Hello " + MARK + "ZCollab" + MARK + " Search",
                DocServiceImpl.buildSnippet("Hello ZCollab Search", "zcollab"));
    }

    @Test
    void escapeLikeKeywordEscapesBackslashBeforePercentAndUnderscore() {
        assertEquals("\\\\", DocServiceImpl.escapeLikeKeyword("\\"));
        assertEquals("\\%", DocServiceImpl.escapeLikeKeyword("%"));
        assertEquals("\\_", DocServiceImpl.escapeLikeKeyword("_"));
        assertEquals("a\\_b", DocServiceImpl.escapeLikeKeyword("a_b"));
        assertEquals("\\\\\\%", DocServiceImpl.escapeLikeKeyword("\\%"));
        assertEquals("c:\\\\tmp\\\\100\\%", DocServiceImpl.escapeLikeKeyword("c:\\tmp\\100%"));
    }

    @Test
    void snippetLocatesLiteralWildcardsWithoutBackslashes() {
        assertEquals("折扣 50" + MARK + "%" + MARK + " off",
                DocServiceImpl.buildSnippet("折扣 50% off", "%"));
        String snippet = DocServiceImpl.buildSnippet("前缀 a_b 后缀 axb", "a_b");
        assertEquals("前缀 " + MARK + "a_b" + MARK + " 后缀 axb", snippet);
        assertFalse(snippet.contains("\\"));
    }

    @Test
    void searchUsesEscapedKeywordForLikeOnlyAndRawKeywordForSnippet() {
        String[] mapperKeywords = new String[2];
        DocMapper mapper = (DocMapper) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{DocMapper.class},
                (proxy, method, args) -> {
                    if (!method.getName().equals("search")) {
                        throw new UnsupportedOperationException(method.getName());
                    }
                    mapperKeywords[0] = (String) args[1];
                    mapperKeywords[1] = (String) args[2];
                    DocSearchRow row = new DocSearchRow();
                    row.setId(7L);
                    row.setTitle("折扣公告");
                    row.setContentText("折扣 50% off");
                    row.setScore(1.0);
                    return List.of(row);
                });
        WorkspaceMemberService members = (WorkspaceMemberService) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{WorkspaceMemberService.class},
                (proxy, method, args) -> new WorkspaceMembership(1L, "owner"));
        SearchDocRequest request = new SearchDocRequest();
        request.setKeyword("%");

        List<DocSearchResponse> result = new DocServiceImpl(mapper, null, members, null, null).search(request);

        assertEquals("%", mapperKeywords[0]);
        assertEquals("\\%", mapperKeywords[1]);
        assertEquals("折扣 50" + MARK + "%" + MARK + " off", result.get(0).snippet());
        assertFalse(result.get(0).snippet().contains("\\"));
    }

    @Test
    void moveRejectsParentInsideOwnSubtreeBeforeUpdating() {
        MoveHarness harness = new MoveHarness();
        harness.addDoc(1L, null, 1L);
        harness.addDoc(2L, 1L, 1L);
        harness.addDoc(3L, 2L, 1L);
        harness.descendants = List.of(1L, 2L, 3L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> harness.service().move(1L, 3L));

        assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        assertEquals("不能移动到自己的子页面下", error.getMessage());
        assertEquals(List.of("selectById", "selectById", "selectDescendantIds"), harness.calls);
        assertEquals(0, harness.updateCount);
    }

    @Test
    void moveRejectsSelfWithItsOwnMessage() {
        MoveHarness harness = new MoveHarness();
        harness.addDoc(1L, null, 1L);
        harness.descendants = List.of(1L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> harness.service().move(1L, 1L));

        assertEquals(ErrorCode.BAD_REQUEST, error.getErrorCode());
        assertEquals("不能移动到自身", error.getMessage());
        assertEquals(0, harness.updateCount);
    }

    @Test
    void moveRejectsParentFromAnotherWorkspaceAsNotFound() {
        MoveHarness harness = new MoveHarness();
        harness.addDoc(1L, null, 1L);
        harness.addDoc(2L, null, 2L);

        BusinessException error = assertThrows(BusinessException.class,
                () -> harness.service().move(1L, 2L));

        assertEquals(ErrorCode.NOT_FOUND, error.getErrorCode());
        assertEquals(List.of("selectById", "selectById"), harness.calls);
        assertEquals(0, harness.updateCount);
    }

    @Test
    void moveToCurrentParentSkipsUpdate() {
        MoveHarness harness = new MoveHarness();
        harness.addDoc(1L, null, 1L);
        harness.addDoc(2L, 1L, 1L);

        harness.service().move(2L, 1L);

        assertEquals(List.of("selectById", "selectById", "selectDescendantIds"), harness.calls);
        assertEquals(0, harness.updateCount);
    }

    @Test
    void moveUpdatesOnlyParentColumn() {
        MoveHarness harness = new MoveHarness();
        harness.addDoc(2L, 1L, 1L);
        harness.addDoc(4L, null, 1L);

        harness.service().move(2L, 4L);

        assertEquals(1, harness.updateCount);
        String set = harness.updateWrapper.getSqlSet();
        assertTrue(set.contains("parent_doc_id"));
        assertFalse(set.contains("title"));
        assertFalse(set.contains("content"));
        assertFalse(set.contains("updated_at"));
        assertTrue(harness.updateWrapper.getSqlSegment().contains("id"));
        assertTrue(harness.updateWrapper.getSqlSegment().contains("workspace_id"));
        assertTrue(harness.updateWrapper.getSqlSegment().contains("deleted_at"));
        assertTrue(harness.updateWrapper.getParamNameValuePairs().values().contains(4L));
    }

    @Test
    void moveToTopLevelClearsParentColumn() {
        MoveHarness harness = new MoveHarness();
        harness.addDoc(2L, 1L, 1L);

        harness.service().move(2L, null);

        assertEquals(1, harness.updateCount);
        assertTrue(harness.updateWrapper.getSqlSet().contains("parent_doc_id"));
        assertTrue(harness.updateWrapper.getParamNameValuePairs().values().contains(null));
    }

    private static class MoveHarness {
        final Map<Long, Doc> docs = new HashMap<>();
        final List<String> calls = new ArrayList<>();
        List<Long> descendants = List.of();
        LambdaUpdateWrapper<Doc> updateWrapper;
        int updateCount;

        void addDoc(long id, Long parentId, long workspaceId) {
            Doc doc = new Doc();
            doc.setId(id);
            doc.setParentDocId(parentId);
            doc.setWorkspaceId(workspaceId);
            docs.put(id, doc);
        }

        @SuppressWarnings("unchecked")
        DocServiceImpl service() {
            DocMapper mapper = (DocMapper) Proxy.newProxyInstance(
                    getClass().getClassLoader(), new Class<?>[]{DocMapper.class},
                    (proxy, method, args) -> {
                        calls.add(method.getName());
                        return switch (method.getName()) {
                            case "selectById" -> docs.get(args[0]);
                            case "selectDescendantIds" -> descendants;
                            case "update" -> {
                                updateCount += 1;
                                updateWrapper = (LambdaUpdateWrapper<Doc>) args[1];
                                yield 1;
                            }
                            default -> throw new UnsupportedOperationException(method.getName());
                        };
                    });
            WorkspaceMemberService members = (WorkspaceMemberService) Proxy.newProxyInstance(
                    getClass().getClassLoader(), new Class<?>[]{WorkspaceMemberService.class},
                    (proxy, method, args) -> new WorkspaceMembership(1L, "owner"));
            return new DocServiceImpl(mapper, null, members, null, null);
        }
    }
}
