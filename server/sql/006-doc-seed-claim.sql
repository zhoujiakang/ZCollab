-- 旧内容迁移认领时间：仅服务端通过一条原子 UPDATE 写入，
-- 用于让多个客户端竞争时只有一端负责把 doc.content 灌进 Yjs。
ALTER TABLE doc ADD COLUMN IF NOT EXISTS seed_claimed_at timestamptz;

COMMENT ON COLUMN doc.seed_claimed_at IS '旧内容迁移认领时间，60 秒内无 doc_update 则视为放弃';
