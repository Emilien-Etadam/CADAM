import { config } from 'dotenv';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pool, ensureLocalUser, devUser } from './db.js';
import { handleParametricChatRequest } from './parametricChat.js';
import { handleTitleGeneratorRequest } from './titleGenerator.js';
import { handlePromptGeneratorRequest } from './promptGenerator.js';
import { getModelsListPayload } from './lib/localOpenAiModel.js';

config({ path: '.env.local' });
config();

const DEV_CORS_ORIGINS = new Set([
  'http://192.168.30.212:4173',
  'http://192.168.30.212:4174',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4174',
  'http://localhost:4173',
  'http://localhost:4174',
]);

function localCorsHeaders(
  req: import('node:http').IncomingMessage,
): Record<string, string> {
  const origin = req.headers.origin;
  if (origin && DEV_CORS_ORIGINS.has(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    };
  }
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };
}

const HOST = process.env.LOCAL_SERVER_HOST ?? '127.0.0.1';
const PORT = parseInt(process.env.LOCAL_SERVER_PORT ?? '8787', 10);

async function readJsonBody(
  req: import('node:http').IncomingMessage,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function sendWebResponse(
  res: import('node:http').ServerResponse,
  web: Response,
) {
  const headers: Record<string, string> = {};
  web.headers.forEach((v, k) => {
    headers[k] = v;
  });
  res.writeHead(web.status, headers);
  if (web.body) {
    await pipeline(Readable.fromWeb(web.body as never), res);
  } else {
    res.end();
  }
}

createServer(async (req, res) => {
  if (!req.url || !req.method) {
    res.writeHead(400);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, localCorsHeaders(req));
    res.end();
    return;
  }

  try {
    await ensureLocalUser();
  } catch (e) {
    console.error(e);
    res.writeHead(500, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({ error: 'database_unavailable' }));
    return;
  }

  const uid = devUser().id;

  if (url.pathname === '/api/models' && req.method === 'GET') {
    try {
      const payload = await getModelsListPayload(req.headers.authorization);
      res.writeHead(200, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(payload));
    } catch (e) {
      console.error(e);
      res.writeHead(500, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: 'models_unavailable' }));
    }
    return;
  }

  if (url.pathname === '/api/parametric-chat' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const r = await handleParametricChatRequest(body, {
      authorization: req.headers.authorization,
    });
    await sendWebResponse(res, r);
    return;
  }

  if (url.pathname === '/api/title-generator' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const r = await handleTitleGeneratorRequest(body, {
      authorization: req.headers.authorization,
    });
    await sendWebResponse(res, r);
    return;
  }

  if (url.pathname === '/api/prompt-generator' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const r = await handlePromptGeneratorRequest(body, {
      authorization: req.headers.authorization,
    });
    await sendWebResponse(res, r);
    return;
  }

  if (url.pathname === '/api/conversations' && req.method === 'GET') {
    const limit = url.searchParams.get('limit');
    const history = url.searchParams.get('history') === '1';
    if (history) {
      const r = await pool.query(
        `SELECT c.*,
          (SELECT content FROM messages m WHERE m.conversation_id = c.id
           ORDER BY m.created_at ASC LIMIT 1) AS first_message_content,
          (SELECT count(*)::int FROM messages m WHERE m.conversation_id = c.id) AS message_count
         FROM conversations c
         WHERE c.user_id = $1
         ORDER BY c.updated_at DESC`,
        [uid],
      );
      res.writeHead(200, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(r.rows));
      return;
    }
    const n = Math.min(100, Math.max(1, parseInt(limit ?? '10', 10) || 10));
    const r = await pool.query(
      `SELECT * FROM conversations WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [uid, n],
    );
    res.writeHead(200, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(r.rows));
    return;
  }

  if (url.pathname === '/api/conversations' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const {
      id,
      title = 'New Conversation',
      type = 'parametric',
      settings = {},
    } = body as {
      id?: string;
      title?: string;
      type?: string;
      settings?: object;
    };
    const cid = (id as string) ?? crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO conversations (id, user_id, title, type, settings)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [cid, uid, title, type, JSON.stringify(settings)],
    );
    res.writeHead(200, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(r.rows[0]));
    return;
  }

  const convMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)$/);
  if (convMatch) {
    const id = convMatch[1]!;

    if (req.method === 'GET') {
      const r = await pool.query(
        `SELECT * FROM conversations WHERE id = $1 AND user_id = $2`,
        [id, uid],
      );
      if (r.rowCount === 0) {
        res.writeHead(404, {
          ...localCorsHeaders(req),
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }
      res.writeHead(200, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(r.rows[0]));
      return;
    }

    if (req.method === 'PATCH') {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const cur = await pool.query(
        `SELECT * FROM conversations WHERE id = $1 AND user_id = $2`,
        [id, uid],
      );
      if (cur.rowCount === 0) {
        res.writeHead(404, {
          ...localCorsHeaders(req),
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: 'not_found' }));
        return;
      }
      const row = cur.rows[0] as Record<string, unknown>;
      const title = (body.title ?? row.title) as string;
      const typ = (body.type ?? row.type) as string;
      const privacy = (body.privacy ?? row.privacy) as string;
      const leaf = (body.current_message_leaf_id ??
        row.current_message_leaf_id) as string | null;
      const settings =
        body.settings !== undefined
          ? JSON.stringify(body.settings)
          : JSON.stringify(row.settings);
      const r = await pool.query(
        `UPDATE conversations SET title = $1, type = $2, privacy = $3,
          current_message_leaf_id = $4, settings = $5::jsonb, updated_at = now()
         WHERE id = $6 AND user_id = $7
         RETURNING *`,
        [title, typ, privacy, leaf, settings, id, uid],
      );
      res.writeHead(200, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify(r.rows[0]));
      return;
    }

    if (req.method === 'DELETE') {
      await pool.query(
        `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
        [id, uid],
      );
      res.writeHead(204, localCorsHeaders(req));
      res.end();
      return;
    }
  }

  const msgList = url.pathname.match(
    /^\/api\/conversations\/([^/]+)\/messages$/,
  );
  if (msgList && req.method === 'GET') {
    const conversationId = msgList[1]!;
    const r = await pool.query(
      `SELECT m.id, m.created_at, m.conversation_id, m.role, m.content, m.parent_message_id, m.rating
       FROM messages m
       INNER JOIN conversations c ON c.id = m.conversation_id
       WHERE m.conversation_id = $1 AND c.user_id = $2
       ORDER BY m.created_at ASC`,
      [conversationId, uid],
    );
    res.writeHead(200, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(r.rows));
    return;
  }

  if (url.pathname === '/api/messages' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const {
      id,
      conversation_id,
      role,
      content,
      parent_message_id,
      rating = 0,
    } = body as {
      id?: string;
      conversation_id: string;
      role: 'user' | 'assistant';
      content: object;
      parent_message_id?: string | null;
      rating?: number;
    };
    const mid = id ?? crypto.randomUUID();
    const r = await pool.query(
      `INSERT INTO messages (id, conversation_id, user_id, role, content, parent_message_id, rating)
       SELECT $1, $2, $3, $4, $5::jsonb, $6, $7
       FROM conversations c
       WHERE c.id = $2 AND c.user_id = $3
       RETURNING id, created_at, conversation_id, role, content, parent_message_id, rating`,
      [
        mid,
        conversation_id,
        uid,
        role,
        JSON.stringify(content),
        parent_message_id ?? null,
        rating,
      ],
    );
    if (r.rowCount === 0) {
      res.writeHead(403, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: 'forbidden' }));
      return;
    }
    res.writeHead(200, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(r.rows[0]));
    return;
  }

  const msgPatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/);
  if (msgPatch && (req.method === 'PATCH' || req.method === 'PUT')) {
    const messageId = msgPatch[1]!;
    const body = (await readJsonBody(req)) as {
      content: object;
      rating?: number;
    };
    const r = await pool.query(
      `UPDATE messages m SET
         content = $1::jsonb,
         rating = COALESCE($2, m.rating)
       FROM conversations c
       WHERE m.id = $3 AND m.conversation_id = c.id AND c.user_id = $4
       RETURNING m.id, m.created_at, m.conversation_id, m.role, m.content, m.parent_message_id, m.rating`,
      [
        JSON.stringify(body.content),
        body.rating !== undefined ? body.rating : null,
        messageId,
        uid,
      ],
    );
    if (r.rowCount === 0) {
      res.writeHead(404, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }
    res.writeHead(200, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(r.rows[0]));
    return;
  }

  if (url.pathname === '/api/messages' && req.method === 'GET') {
    const conversationId = url.searchParams.get('conversationId');
    if (!conversationId) {
      res.writeHead(400, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: 'conversationId' }));
      return;
    }
    const r = await pool.query(
      `SELECT m.id, m.created_at, m.conversation_id, m.role, m.content, m.parent_message_id, m.rating
       FROM messages m
       INNER JOIN conversations c ON c.id = m.conversation_id
       WHERE m.conversation_id = $1 AND c.user_id = $2
       ORDER BY m.created_at ASC`,
      [conversationId, uid],
    );
    res.writeHead(200, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(r.rows));
    return;
  }

  if (url.pathname === '/api/visual-messages' && req.method === 'GET') {
    const conversationId = url.searchParams.get('conversationId');
    if (!conversationId) {
      res.writeHead(400, {
        ...localCorsHeaders(req),
        'Content-Type': 'application/json',
      });
      res.end(JSON.stringify({ error: 'conversationId' }));
      return;
    }
    const r = await pool.query(
      `SELECT m.content
       FROM messages m
       INNER JOIN conversations c ON c.id = m.conversation_id
       WHERE m.conversation_id = $1 AND c.user_id = $2 AND m.role = 'assistant'
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [conversationId, uid],
    );
    res.writeHead(200, {
      ...localCorsHeaders(req),
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify(r.rows));
    return;
  }

  res.writeHead(404, {
    ...localCorsHeaders(req),
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify({ error: 'not_found' }));
}).listen(PORT, HOST, () => {
  console.log(`Local CADAM server http://${HOST}:${PORT}`);
});
