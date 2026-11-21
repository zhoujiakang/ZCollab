package com.zcollab.vo.share;

/** 公开只读接口的最小响应：只有标题、正文和更新时间。 */
public record PublicShareResponse(String title, String content, String updatedAt) {
}
