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
