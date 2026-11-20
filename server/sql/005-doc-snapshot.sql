-- 文档快照列：snapshot 是客户端 Y.encodeStateAsUpdate(doc) 得到的完整 update，
-- snapshot_seq 是这份快照覆盖到的最大 doc_update.seq（没有快照时为 0）。
ALTER TABLE doc ADD COLUMN IF NOT EXISTS snapshot bytea;
ALTER TABLE doc ADD COLUMN IF NOT EXISTS snapshot_seq bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN doc.snapshot IS '客户端提交的完整文档 update（Y.encodeStateAsUpdate）';
COMMENT ON COLUMN doc.snapshot_seq IS '快照覆盖到的 doc_update.seq，无快照时为 0';
