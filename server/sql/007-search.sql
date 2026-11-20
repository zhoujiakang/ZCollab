CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE doc ADD COLUMN IF NOT EXISTS content_text text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_doc_title_trgm ON doc USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_doc_content_text_trgm ON doc USING gin (content_text gin_trgm_ops);
