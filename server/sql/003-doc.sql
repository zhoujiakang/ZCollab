\set app_user zcollab

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

CREATE INDEX IF NOT EXISTS idx_doc_workspace_parent ON doc (workspace_id, parent_doc_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT, INSERT, UPDATE, DELETE ON doc TO :app_user;
GRANT EXECUTE ON FUNCTION set_updated_at() TO :app_user;

DROP TRIGGER IF EXISTS trg_doc_set_updated_at ON doc;
CREATE TRIGGER trg_doc_set_updated_at
    BEFORE UPDATE ON doc
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
