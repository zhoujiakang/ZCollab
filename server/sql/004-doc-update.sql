\set app_user zcollab

CREATE TABLE IF NOT EXISTS doc_update (
    id         bigint PRIMARY KEY,
    doc_id     bigint NOT NULL,
    seq        bigint NOT NULL,
    payload    bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_doc_update_doc_seq UNIQUE (doc_id, seq)
);

-- doc 软删时不删这些行；doc_id 查询走 (doc_id, seq) 唯一键的左前缀，不另建索引。

GRANT SELECT, INSERT, UPDATE, DELETE ON doc_update TO :app_user;
