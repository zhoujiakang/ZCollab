\set app_user zcollab

CREATE TABLE IF NOT EXISTS sys_user (
    id             bigint PRIMARY KEY,
    username       varchar(64) NOT NULL,
    name           varchar(255) NOT NULL,
    password       varchar(255) NOT NULL,
    avatar_url     varchar(512),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_sys_user_username ON sys_user (username);

GRANT SELECT, INSERT, UPDATE, DELETE ON sys_user TO :app_user;
