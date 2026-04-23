// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { corsHeaders } from '../_shared/cors.ts';
import 'jsr:@std/dotenv/load';
import { getAnonSupabaseClient } from '../_shared/supabaseClient.ts';
import { Content } from '@shared/types.ts';
import { formatCreativeUserMessage } from '../_shared/messageUtils.ts';

const OPENAI_BASE_URL = (
  Deno.env.get('OPENAI_BASE_URL') ?? 'http://192.168.30.121:8000/v1'
).replace(/\/$/, '');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? 'changeme';
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? '/model';
const CHAT_COMPLETIONS_URL = `${OPENAI_BASE_URL}/chat/completions`;

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

/** Map Anthropic-style blocks from formatCreativeUserMessage to OpenAI chat content. */
function toOpenAIUserContent(parts: unknown[]): string | OpenAIUserContentPart[] {
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
  if (out.length === 1 && out[0].type === 'text') {
    return out[0].text;
  }
  return out;
}

// Main server function handling incoming requests
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Ensure only POST requests are accepted
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Extract prompt from request body
  const {
    content,
    conversationId,
  }: { content: Content; conversationId: string } = await req.json();

  const supabaseClient = getAnonSupabaseClient({
    global: {
      headers: { Authorization: req.headers.get('Authorization') ?? '' },
    },
  });

  const { data: userData, error: userError } =
    await supabaseClient.auth.getUser();

  if (!userData.user) {
    return new Response(
      JSON.stringify({ error: { message: 'Unauthorized' } }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  if (userError) {
    return new Response(
      JSON.stringify({ error: { message: userError.message } }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  const userMessage = await formatCreativeUserMessage(
    { id: '1', role: 'user', content: content },
    supabaseClient,
    userData.user.id,
    conversationId,
  );

  const userContent = toOpenAIUserContent(userMessage.content as unknown[]);

  try {
    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 100,
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

    // Extract title from response
    let title = 'New Conversation';
    const msgContent = data.choices?.[0]?.message?.content;
    if (typeof msgContent === 'string' && msgContent.trim()) {
      title = msgContent.trim();

      // Ensure title is not too long for the database
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

    // Fallback to basic title generation
    const fallbackTitle = 'New Conversation';

    return new Response(
      JSON.stringify({
        title: fallbackTitle,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 200, // Still return 200 with a fallback title
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
