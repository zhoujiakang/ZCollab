\set app_user zcollab

CREATE TABLE IF NOT EXISTS doc_favorite (
    id           bigint PRIMARY KEY,
    workspace_id bigint NOT NULL,
    user_id      bigint NOT NULL,
    doc_id       bigint NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_doc_favorite_user_doc
    ON doc_favorite (user_id, doc_id);

CREATE INDEX IF NOT EXISTS idx_doc_favorite_user_workspace_created
    ON doc_favorite (user_id, workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS doc_visit (
    id           bigint PRIMARY KEY,
    workspace_id bigint NOT NULL,
    user_id      bigint NOT NULL,
    doc_id       bigint NOT NULL,
    visited_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_doc_visit_user_doc
    ON doc_visit (user_id, doc_id);

CREATE INDEX IF NOT EXISTS idx_doc_visit_user_workspace_visited
    ON doc_visit (user_id, workspace_id, visited_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON doc_favorite, doc_visit TO :app_user;
