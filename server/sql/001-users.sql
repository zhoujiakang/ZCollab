CREATE TABLE IF NOT EXISTS sys_user (
    id             bigint PRIMARY KEY,
    username       varchar(64) NOT NULL,
    name           varchar(255) NOT NULL,
    password       varchar(255) NOT NULL,
    avatar_url     varchar(512),
    role           varchar(32),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS uk_users_username_lower;
DROP INDEX IF EXISTS uk_users_username;

CREATE UNIQUE INDEX IF NOT EXISTS uk_sys_user_username ON sys_user (username);
