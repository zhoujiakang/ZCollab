\set app_user zcollab

CREATE TABLE IF NOT EXISTS workspace (
    id         bigint PRIMARY KEY,
    name       varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_member (
    id           bigint PRIMARY KEY,
    workspace_id bigint NOT NULL,
    user_id      bigint NOT NULL,
    role         varchar(32) NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_workspace_member_workspace_user UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_member_user_id ON workspace_member (user_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

GRANT SELECT, INSERT, UPDATE, DELETE ON workspace, workspace_member TO :app_user;
GRANT EXECUTE ON FUNCTION set_updated_at() TO :app_user;

DROP TRIGGER IF EXISTS trg_sys_user_set_updated_at ON sys_user;
CREATE TRIGGER trg_sys_user_set_updated_at
    BEFORE UPDATE ON sys_user
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_set_updated_at ON workspace;
CREATE TRIGGER trg_workspace_set_updated_at
    BEFORE UPDATE ON workspace
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_workspace_member_set_updated_at ON workspace_member;
CREATE TRIGGER trg_workspace_member_set_updated_at
    BEFORE UPDATE ON workspace_member
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
