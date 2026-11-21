package com.zcollab.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import com.zcollab.dto.doc.SearchDocRequest;
import com.zcollab.mapper.DocMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.doc.DocSearchResponse;
import com.zcollab.vo.doc.DocSearchRow;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.List;

class DocServiceImplTest {

    private static final String MARK = "\u0001";

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
}
