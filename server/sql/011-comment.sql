\set app_user zcollab

CREATE TABLE IF NOT EXISTS doc_comment (
    id           bigint PRIMARY KEY,
    workspace_id bigint NOT NULL,
    doc_id       bigint NOT NULL,
    user_id      bigint NOT NULL,
    parent_id    bigint,
    quote        text,
    anchor_from  int,
    anchor_to    int,
    body         text NOT NULL,
    resolved_at  timestamptz,
    resolved_by  bigint,
    deleted_at   timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_comment_doc_created
    ON doc_comment (doc_id, created_at);

CREATE INDEX IF NOT EXISTS idx_doc_comment_parent
    ON doc_comment (parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON doc_comment TO :app_user;
