import pg from 'pg';
import type { Content, Message } from '@shared/types.ts';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

export function devUser() {
  return {
    id: process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-000000000001',
    email: process.env.DEV_USER_EMAIL ?? 'local@localhost',
  };
}

export async function ensureLocalUser() {
  const u = devUser();
  await pool.query(
    `INSERT INTO users (id, email) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [u.id, u.email],
  );
}

export async function listMessagesForConversation(
  conversationId: string,
): Promise<Message[]> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT id, created_at, conversation_id, role, content, parent_message_id, rating
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC`,
    [conversationId],
  );
  return r.rows.map(rowToMessage);
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    conversation_id: String(row.conversation_id),
    role: row.role as 'user' | 'assistant',
    content: row.content as Content,
    parent_message_id: (row.parent_message_id as string) ?? null,
    rating: Number(row.rating ?? 0),
  };
}

export async function insertAssistantPlaceholder(row: {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'assistant';
  content: Content;
  parent_message_id: string;
}): Promise<Message | null> {
  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO messages (id, conversation_id, user_id, role, content, parent_message_id, rating)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, 0)
     RETURNING id, created_at, conversation_id, role, content, parent_message_id, rating`,
    [
      row.id,
      row.conversation_id,
      row.user_id,
      row.role,
      JSON.stringify(row.content),
      row.parent_message_id,
    ],
  );
  if (r.rowCount === 0) {
    return null;
  }
  return rowToMessage(r.rows[0]!);
}

export async function updateMessageContent(
  messageId: string,
  content: Content,
): Promise<Message> {
  const r = await pool.query<Record<string, unknown>>(
    `UPDATE messages SET content = $1::jsonb WHERE id = $2
     RETURNING id, created_at, conversation_id, role, content, parent_message_id, rating`,
    [JSON.stringify(content), messageId],
  );
  if (r.rowCount === 0) {
    throw new Error('update_failed');
  }
  return rowToMessage(r.rows[0]!);
}

export async function query<T = unknown>(text: string, params?: unknown[]) {
  return pool.query<T>(text, params);
}
