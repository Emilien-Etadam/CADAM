import { useAuth } from '@/contexts/AuthContext';
import { getApiBaseUrl } from '@/lib/localBackend';
import { getEffectiveUserId } from '@/lib/localUser';
import { apiGetConversation, apiUpdateConversation } from '@/services/localDataApi';
import { Conversation, Content } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

const defaultConversation: Conversation = {
  id: '',
  title: '',
  current_message_leaf_id: null,
  user_id: '',
  created_at: '',
  updated_at: '',
  privacy: 'private',
  type: 'parametric',
  settings: null,
};

export function useConversation() {
  const { id: conversationId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversation, isLoading: isConversationLoading } =
    useQuery<Conversation>({
      queryKey: ['conversation', conversationId],
      enabled: !!conversationId,
      refetchOnMount: false,
      queryFn: async () => {
        if (!conversationId) {
          throw new Error('Conversation ID is required');
        }
        const uid = getEffectiveUserId(user?.id);
        if (!uid) {
          throw new Error('User must be authenticated');
        }
        return apiGetConversation(conversationId);
      },
    });

  const { mutate: updateConversation, mutateAsync: updateConversationAsync } =
    useMutation({
      mutationFn: async (c: Conversation) => apiUpdateConversation(c),
      onMutate: async (conversation) => {
        await queryClient.cancelQueries({
          queryKey: ['conversation', conversation.id],
        });
        const oldConversation = queryClient.getQueryData<Conversation>([
          'conversation',
          conversation.id,
        ]);
        queryClient.setQueryData(
          ['conversation', conversation.id],
          conversation,
        );
        return { oldConversation };
      },
      onSuccess: (data) => {
        queryClient.setQueryData(['conversation', conversationId], data);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      },
      onError: (_error, conversation, context) => {
        queryClient.setQueryData(
          ['conversation', conversation.id],
          context?.oldConversation,
        );
      },
    });

  return {
    conversation: conversation ?? defaultConversation,
    isConversationLoading,
    updateConversation,
    updateConversationAsync,
  };
}

export async function generateConversationTitle(
  conversationId: string,
  content: Content,
): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/api/title-generator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, conversationId, model: content.model }),
  });
  if (!response.ok) {
    throw new Error(`Failed to generate title: ${response.statusText}`);
  }
  const data = (await response.json()) as { title?: string };
  return data.title || 'New Conversation';
}
