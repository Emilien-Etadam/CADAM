import type { Content, CoreMessage } from '@shared/types.ts';

type ContentBlockParam = {
  type: 'text';
  text: string;
} | {
  type: 'image';
  source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string };
};

export async function formatCreativeUserMessage(
  message: CoreMessage,
  _userId: string,
  _conversationId: string,
): Promise<{
  role: 'user';
  content: ContentBlockParam[];
}> {
  const parts: ContentBlockParam[] = [];
  const c: Content = message.content;

  if (c.text) {
    parts.push({ type: 'text', text: c.text });
  }

  if (c.images?.length) {
    parts.push({
      type: 'text',
      text: `User uploaded image(s) with the ID(s) ${c.images.join(', ')} (local mode — no signed URLs from storage).`,
    });
  }

  if (c.mesh) {
    parts.push({
      type: 'text',
      text: `User uploaded mesh with the ID ${c.mesh.id} (local mode — no preview from storage).`,
    });
  }

  return { role: 'user', content: parts };
}
