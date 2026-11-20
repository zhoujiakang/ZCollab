CREATE TABLE IF NOT EXISTS doc (
    id             bigint PRIMARY KEY,
    workspace_id   bigint NOT NULL,
    parent_doc_id  bigint,
    title          varchar(255) NOT NULL DEFAULT '',
    content        text NOT NULL DEFAULT '',
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    deleted_at     timestamptz
);
