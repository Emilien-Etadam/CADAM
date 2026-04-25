-- Minimal schema for local CADAM text flow (PostgreSQL + vLLM). Run once:
--   psql "$DATABASE_URL" -f server/migrations/init.sql

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  type text NOT NULL DEFAULT 'parametric',
  privacy text NOT NULL DEFAULT 'private',
  current_message_leaf_id uuid,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content jsonb NOT NULL,
  parent_message_id uuid,
  rating smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id);

CREATE OR REPLACE FUNCTION update_conversation_leaf() RETURNS trigger AS $$
BEGIN
  UPDATE conversations SET
    current_message_leaf_id = NEW.id,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_leaf_trigger ON messages;
CREATE TRIGGER update_leaf_trigger
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE PROCEDURE update_conversation_leaf();
