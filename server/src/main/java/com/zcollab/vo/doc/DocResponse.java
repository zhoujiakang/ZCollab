package com.zcollab.vo.doc;

public record DocResponse(Long id, Long parentDocId, String title, String content, String contentText) {
}
