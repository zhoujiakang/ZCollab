CREATE TABLE IF NOT EXISTS sys_user (
    id             bigint PRIMARY KEY,
    username       varchar(64) NOT NULL,
    name           varchar(255) NOT NULL,
    password       varchar(255) NOT NULL,
    avatar_url     varchar(512),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uk_sys_user_username UNIQUE (username)
);
