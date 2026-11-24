package com.zcollab.service;

/** Carries the revoked token internally so only its own connections are disconnected. */
public record LoginTokenRevoked(String token) {
    @Override
    public String toString() {
        return "LoginTokenRevoked[redacted]";
    }
}
