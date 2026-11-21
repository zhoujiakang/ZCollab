\set app_user zcollab

CREATE TABLE IF NOT EXISTS share_link (
    id           bigint PRIMARY KEY,
    doc_id       bigint NOT NULL,
    workspace_id bigint NOT NULL,
    token        varchar(32) NOT NULL UNIQUE,
    created_by   bigint NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    revoked_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_share_link_active_doc
    ON share_link (doc_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON share_link TO :app_user;
