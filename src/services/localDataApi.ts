import { getApiBaseUrl } from '@/lib/localBackend';
import type { Content, Conversation, Message } from '@shared/types';

const base = () => getApiBaseUrl();

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json() as Promise<T>;
}

export async function apiGetConversation(
  conversationId: string,
): Promise<Conversation> {
  return j<Conversation>(`/api/conversations/${conversationId}`);
}

export async function apiUpdateConversation(
  conversation: Conversation,
): Promise<Conversation> {
  return j<Conversation>(`/api/conversations/${conversation.id}`, {
    method: 'PATCH',
    body: JSON.stringify(conversation),
  });
}

export async function apiListMessages(
  conversationId: string,
): Promise<Message[]> {
  return j<Message[]>(`/api/conversations/${conversationId}/messages`);
}

export async function apiInsertMessage(
  message: Omit<Message, 'id' | 'created_at' | 'rating'> & {
    id?: string;
    rating?: number;
  },
): Promise<Message> {
  return j<Message>(`/api/messages`, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export async function apiUpdateMessage(message: Message): Promise<Message> {
  return j<Message>(`/api/messages/${message.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      content: message.content,
      rating: message.rating,
    }),
  });
}

export async function apiListRecentConversations(
  limit: number,
): Promise<Conversation[]> {
  return j<Conversation[]>(`/api/conversations?limit=${limit}`);
}

export type HistoryApiRow = Conversation & {
  first_message_content?: Content | null;
  message_count?: number;
};

export async function apiListHistoryConversations(): Promise<HistoryApiRow[]> {
  return j<HistoryApiRow[]>(`/api/conversations?history=1`);
}

export async function apiCreateConversation(row: {
  id: string;
  title: string;
  type: string;
  settings: object;
}): Promise<Conversation> {
  return j<Conversation>(`/api/conversations`, {
    method: 'POST',
    body: JSON.stringify(row),
  });
}

export async function apiDeleteConversation(
  conversationId: string,
): Promise<void> {
  const r = await fetch(`${base()}/api/conversations/${conversationId}`, {
    method: 'DELETE',
  });
  if (!r.ok) {
    throw new Error(r.statusText);
  }
}

export async function apiPatchConversation(
  id: string,
  patch: Partial<
    Pick<
      Conversation,
      | 'title'
      | 'privacy'
      | 'type'
      | 'current_message_leaf_id'
      | 'settings'
    >
  >,
): Promise<Conversation> {
  return j<Conversation>(`/api/conversations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function apiVisualAssistantMessages(
  conversationId: string,
): Promise<Array<{ content: Content }>> {
  return j(
    `/api/visual-messages?conversationId=${encodeURIComponent(conversationId)}`,
  );
}
