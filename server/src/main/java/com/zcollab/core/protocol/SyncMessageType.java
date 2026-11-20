package com.zcollab.core.protocol;

/**
 * y-protocols/sync.js: messageYjsSyncStep1, messageYjsSyncStep2, messageYjsUpdate.
 */
public enum SyncMessageType {
    STEP_1(0, "messageYjsSyncStep1"),
    STEP_2(1, "messageYjsSyncStep2"),
    UPDATE(2, "messageYjsUpdate");

    private final int code;
    private final String protocolName;

    SyncMessageType(int code, String protocolName) {
        this.code = code;
        this.protocolName = protocolName;
    }

    public int getCode() {
        return code;
    }

    public String getProtocolName() {
        return protocolName;
    }

    public static SyncMessageType fromCode(int code) {
        for (SyncMessageType type : values()) {
            if (type.code == code) {
                return type;
            }
        }
        throw new IllegalArgumentException("unknown sync message type: " + code);
    }
}
