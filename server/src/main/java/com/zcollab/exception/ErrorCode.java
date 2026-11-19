package com.zcollab.exception;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    BAD_REQUEST(400, "请求参数错误", HttpStatus.BAD_REQUEST),
    VALIDATION_FAILED(1001, "请求参数校验失败", HttpStatus.BAD_REQUEST),
    INVALID_CREDENTIALS(1002, "账号或密码错误", HttpStatus.UNAUTHORIZED),
    USERNAME_TAKEN(1003, "该账号已被占用", HttpStatus.CONFLICT),
    UNAUTHORIZED(401, "未登录或登录已失效", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(403, "没有权限访问", HttpStatus.FORBIDDEN),
    NOT_FOUND(404, "资源不存在", HttpStatus.NOT_FOUND),
    INTERNAL_ERROR(500, "服务器内部错误", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code;
    private final String message;
    private final HttpStatus httpStatus;

    ErrorCode(int code, String message, HttpStatus httpStatus) {
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    public HttpStatus getHttpStatus() {
        return httpStatus;
    }
}
