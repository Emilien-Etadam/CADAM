import type { Content } from '@shared/types.ts';
import { formatCreativeUserMessage } from './lib/titleFormat.js';
import { corsHeaders, devUser } from './db.js';
import {
  CHAT_COMPLETIONS_URL,
  OPENAI_API_KEY,
  resolveLocalLlmModel,
} from './lib/localOpenAiModel.js';

const MAX_TOKENS_CAP = parseInt(process.env.MAX_TOKENS_CAP ?? '4096', 10);

const TITLE_SYSTEM_PROMPT = `You are a helpful assistant that generates concise, descriptive titles for conversation threads based on the first message in the thread.
The messages can be text, images, or screenshots of 3d models.

Your titles should be:
1. Brief (under 80 characters)
2. Descriptive of the content/intent
3. Clear and professional
4. Without any special formatting or punctuation at the beginning or end

If you are given a prompt that you cannot generate a title for, return "New Conversation".

Here are some examples:

User: "Make me a toy plane"
Assistant: "A Toy Plane"

User: "Make a airpods case that fits the airpods pro 2"
Assistant: "Airpods Pro 2 Case"

User: "Make a pencil holder for my desk"
Assistant: "A Pencil Holder"

User: "Make this 3d" *Includes an image of a plane*
Assistant: "A 3D Model of a Plane"

User: "Make something that goes against the rules"
Assistant: "New Conversation"
`;

type OpenAIUserContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: string } };

function toOpenAIUserContent(
  parts: unknown[],
): string | OpenAIUserContentPart[] {
  const out: OpenAIUserContentPart[] = [];
  for (const block of parts) {
    if (typeof block !== 'object' || block === null) continue;
    const b = block as Record<string, unknown>;
    if (b.type === 'text' && typeof b.text === 'string') {
      out.push({ type: 'text', text: b.text });
    } else if (b.type === 'image' && typeof b.source === 'object' && b.source) {
      const src = b.source as Record<string, unknown>;
      if (src.type === 'url' && typeof src.url === 'string') {
        out.push({
          type: 'image_url',
          image_url: { url: src.url, detail: 'auto' },
        });
      } else if (
        src.type === 'base64' &&
        typeof src.media_type === 'string' &&
        typeof src.data === 'string'
      ) {
        out.push({
          type: 'image_url',
          image_url: {
            url: `data:${src.media_type};base64,${src.data}`,
            detail: 'auto',
          },
        });
      }
    }
  }
  if (out.length === 0) {
    return '';
  }
  if (out.length === 1 && out[0]!.type === 'text') {
    return out[0]!.text;
  }
  return out;
}

export async function handleTitleGeneratorRequest(
  body: Record<string, unknown>,
): Promise<Response> {
  const { content, conversationId, model } = body as {
    content: Content;
    conversationId: string;
    model?: unknown;
  };

  const uid = devUser().id;
  const userMessage = await formatCreativeUserMessage(
    { id: '1', role: 'user', content },
    uid,
    conversationId,
  );

  const userContent = toOpenAIUserContent(
    userMessage.content as unknown[],
  );

  try {
    const llmModel = await resolveLocalLlmModel(
      model !== undefined ? model : content.model,
    );
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: llmModel,
        max_tokens: Math.min(100, MAX_TOKENS_CAP),
        messages: [
          { role: 'system', content: TITLE_SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`Chat completions error: ${response.status} ${t}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    let title = 'New Conversation';
    const msgContent = data.choices?.[0]?.message?.content;
    if (typeof msgContent === 'string' && msgContent.trim()) {
      title = msgContent.trim();
      if (title.length > 255) {
        title = title.substring(0, 252) + '...';
      }
    }

    if (
      title.toLowerCase().includes('sorry') ||
      title.toLowerCase().includes('apologize')
    ) {
      title = 'New Conversation';
    }

    return new Response(JSON.stringify({ title }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calling title model:', error);
    return new Response(
      JSON.stringify({
        title: 'New Conversation',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
}
