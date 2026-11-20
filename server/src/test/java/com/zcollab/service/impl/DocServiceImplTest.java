package com.zcollab.service.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

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
}
