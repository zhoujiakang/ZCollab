\set app_user zcollab

CREATE TABLE IF NOT EXISTS workspace_invite (
    id           bigint PRIMARY KEY,
    workspace_id bigint NOT NULL,
    token        varchar(32) NOT NULL UNIQUE,
    created_by   bigint NOT NULL,
    expires_at   timestamptz,                   -- null = 永不过期
    revoked_at   timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invite_workspace
    ON workspace_invite (workspace_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON workspace_invite TO :app_user;
