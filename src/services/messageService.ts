import { useConversation } from '@/contexts/ConversationContext';
import { getLocalApiModelsQueryKey } from '@/hooks/useLocalApiModels';
import { getApiBaseUrl, getLocalOpenAiAuthHeaders } from '@/lib/localBackend';
import type { LocalApiModelsPayload } from '@/lib/localLlmModelConfigs';
import { resolveParametricModel } from '@/lib/resolveParametricModel';
import { makeUuid } from '@/lib/uuid';
import {
  apiInsertMessage,
  apiListMessages,
  apiUpdateMessage,
} from '@/services/localDataApi';
import { Content, Conversation, Message, type Model } from '@shared/types';
import { HistoryConversation } from '../types/misc.ts';
import {
  QueryClient,
  UseMutateAsyncFunction,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

function messageSentConversationUpdate(
  newMessage: Message,
  conversationId: string,
) {
  return (
    oldConversations: Conversation[] | HistoryConversation[] | undefined,
  ) => {
    if (!oldConversations) return oldConversations;
    return oldConversations
      .map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            current_message_leaf_id: newMessage.id,
            updated_at: newMessage.created_at,
          };
        }
        return conv;
      })
      .sort((a: Conversation, b: Conversation) => {
        return (
          new Date(b.updated_at ?? '').getTime() -
          new Date(a.updated_at ?? '').getTime()
        );
      });
  };
}

function messageInsertedConversationUpdate(
  queryClient: QueryClient,
  newMessage: Message,
  conversationId: string,
) {
  queryClient.setQueryData(
    ['conversation', conversationId],
    (oldConversation: Conversation) => ({
      ...oldConversation,
      current_message_leaf_id: newMessage.id,
    }),
  );
  queryClient.setQueryData(
    ['messages', conversationId],
    (oldMessages: Message[] | undefined) => {
      if (!oldMessages || oldMessages.length === 0) return [newMessage];
      if (oldMessages.find((msg) => msg.id === newMessage.id)) {
        return oldMessages.map((msg) =>
          msg.id === newMessage.id ? newMessage : msg,
        );
      }
      return [...oldMessages, newMessage];
    },
  );
  queryClient.setQueryData(
    ['conversations'],
    messageSentConversationUpdate(newMessage, conversationId),
  );
  queryClient.setQueryData(
    ['conversations', 'recent'],
    messageSentConversationUpdate(newMessage, conversationId),
  );
}

export const useMessagesQuery = () => {
  const { conversation } = useConversation();
  return useQuery<Message[]>({
    enabled: !!conversation.id,
    queryKey: ['messages', conversation.id],
    initialData: [],
    queryFn: async () => apiListMessages(conversation.id),
  });
};

export function useInsertMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      message: Omit<Message, 'id' | 'created_at' | 'rating'>,
    ) => apiInsertMessage(message),
    onSuccess(newMessage) {
      messageInsertedConversationUpdate(
        queryClient,
        newMessage,
        newMessage.conversation_id,
      );
    },
    onError(error, message) {
      console.error('useInsertMessageMutation', error, message);
    },
  });
}

export function useParametricChatMutation({
  conversationId,
}: {
  conversationId: string;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync: insertMessageAsync } = useInsertMessageMutation();

  return useMutation({
    mutationKey: ['parametric-chat', conversationId],
    mutationFn: async ({
      model,
      messageId,
      conversationId: convId,
    }: {
      model: Model;
      messageId: string;
      conversationId: string;
    }) => {
      const newMessageId = makeUuid();
      let initialized = false;

      const response = await fetch(`${getApiBaseUrl()}/api/parametric-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getLocalOpenAiAuthHeaders(),
        },
        body: JSON.stringify({
          conversationId: convId,
          messageId,
          model,
          newMessageId,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Network response was not ok: ${response.status} ${response.statusText}`,
        );
      }

      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const data = (await response.json()) as { message?: Message };
        if (data.message) {
          return data.message;
        }
        throw new Error('No message received');
      }

      async function initialize() {
        await queryClient.cancelQueries({
          queryKey: ['conversation', convId],
        });
        queryClient.setQueryData(
          ['conversation', convId],
          (oldConversation: Conversation) => ({
            ...oldConversation,
            current_message_leaf_id: newMessageId,
          }),
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let leftover = '';
      let finalMessage: Message | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          leftover += decoder.decode(value, { stream: true });
          const lines = leftover.split('\n');
          leftover = lines.pop() ?? '';
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            try {
              const data: Message = JSON.parse(line);
              finalMessage = data;
              queryClient.setQueryData(
                ['messages', convId],
                (oldMessages: Message[] | undefined) => {
                  if (!oldMessages || oldMessages.length === 0) {
                    return [data];
                  }
                  if (oldMessages.find((msg) => msg.id === data.id)) {
                    return oldMessages.map((msg) =>
                      msg.id === data.id ? data : msg,
                    );
                  }
                  return [...oldMessages, data];
                },
              );
              if (!initialized) {
                await initialize();
                initialized = true;
              }
            } catch (parseError) {
              console.error('Error parsing streaming data:', parseError);
            }
          }
        }
        const flushRemainder = decoder.decode();
        if (flushRemainder) leftover += flushRemainder;
        const tail = leftover.trim();
        if (tail) {
          try {
            const data: Message = JSON.parse(tail);
            finalMessage = data;
            queryClient.setQueryData(
              ['messages', convId],
              (oldMessages: Message[] | undefined) => {
                if (!oldMessages || oldMessages.length === 0) {
                  return [data];
                }
                if (oldMessages.find((msg) => msg.id === data.id)) {
                  return oldMessages.map((msg) =>
                    msg.id === data.id ? data : msg,
                  );
                }
                return [...oldMessages, data];
              },
            );
          } catch (parseError) {
            console.error('Error parsing final streaming data:', parseError);
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (!finalMessage) {
        throw new Error('No final message received');
      }
      return finalMessage;
    },
    onSuccess: (newMessage) => {
      messageInsertedConversationUpdate(
        queryClient,
        newMessage,
        conversationId,
      );
    },
    onError: async (error, { messageId }) => {
      console.error('useParametricChatMutation', error, {
        messageId,
        conversationId,
      });
      try {
        await insertMessageAsync({
          role: 'assistant',
          content: { text: 'An error occurred while processing your request.' },
          parent_message_id: messageId,
          conversation_id: conversationId,
        });
      } catch (e) {
        console.error('useParametricChatMutation insert error', e);
      }
    },
  });
}

export function useSendContentMutation({
  conversation,
}: {
  conversation: Pick<
    Conversation,
    'id' | 'user_id' | 'settings' | 'current_message_leaf_id' | 'type'
  >;
}) {
  const { mutateAsync: insertMessageAsync } = useInsertMessageMutation();
  const { mutateAsync: sendToParametricChat } = useParametricChatMutation({
    conversationId: conversation.id,
  });

  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['send-content', conversation.id],
    mutationFn: async (content: Content) => {
      if (content.images?.length || content.mesh) {
        throw new Error('Attachments are not supported in this build.');
      }
      const userMessage = await insertMessageAsync({
        role: 'user',
        content,
        parent_message_id: conversation.current_message_leaf_id ?? null,
        conversation_id: conversation.id,
      });
      const api = queryClient.getQueryData<LocalApiModelsPayload>(
        getLocalApiModelsQueryKey(),
      );
      const parametricModel: Model = resolveParametricModel({
        content,
        conversation,
        apiModels: api,
      });
      await sendToParametricChat({
        model: parametricModel,
        messageId: userMessage.id,
        conversationId: conversation.id,
      });
    },
  });
}

export function useUpdateMessageOptimisticMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ message }: { message: Message }) =>
      apiUpdateMessage(message),
    onMutate: async ({ message }) => {
      await queryClient.cancelQueries({
        queryKey: ['messages', message.conversation_id],
      });
      const oldMessages = queryClient.getQueryData<Message[]>([
        'messages',
        message.conversation_id,
      ]);
      queryClient.setQueryData(
        ['messages', message.conversation_id],
        oldMessages?.map((msg) =>
          msg.id === message.id ? { ...msg, ...message } : msg,
        ),
      );
      return { oldMessages };
    },
    onSettled(_data, _error, { message }) {
      queryClient.invalidateQueries({
        queryKey: ['messages', message.conversation_id],
      });
    },
    onError(error, { message }, context) {
      console.error('useUpdateMessageOptimisticMutation', error, message);
      queryClient.setQueryData(
        ['messages', message.conversation_id],
        context?.oldMessages,
      );
    },
  });
}

export function useEditMessageMutation({
  conversation,
}: {
  conversation: Conversation;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync: insertMessageAsync } = useInsertMessageMutation();
  const { mutateAsync: sendToParametricChat } = useParametricChatMutation({
    conversationId: conversation.id,
  });

  return useMutation({
    mutationKey: ['edit-message', conversation.id],
    mutationFn: async (updatedMessage: Message) => {
      const userMessage = await insertMessageAsync({
        role: updatedMessage.role,
        content: updatedMessage.content,
        parent_message_id: updatedMessage.parent_message_id ?? null,
        conversation_id: conversation.id,
      });
      const api = queryClient.getQueryData<LocalApiModelsPayload>(
        getLocalApiModelsQueryKey(),
      );
      const parametricModel: Model = resolveParametricModel({
        content: updatedMessage.content,
        conversation,
        apiModels: api,
      });
      await sendToParametricChat({
        model: parametricModel,
        messageId: userMessage.id,
        conversationId: conversation.id,
      });
    },
    onError: (error, updatedMessage) => {
      console.error('useEditMessageMutation', error, {
        updatedMessage,
        conversationId: conversation.id,
      });
    },
  });
}

export function useRetryMessageMutation({
  conversation,
  updateConversationAsync,
}: {
  conversation: Conversation;
  updateConversationAsync?: UseMutateAsyncFunction<
    Conversation,
    Error,
    Conversation
  >;
}) {
  const { mutateAsync: sendToParametricChat } = useParametricChatMutation({
    conversationId: conversation.id,
  });

  return useMutation({
    mutationKey: ['retry-message', conversation.id],
    mutationFn: async ({ model, id }: { model: Model; id: string }) => {
      if (!updateConversationAsync) {
        throw new Error('Cannot update conversation');
      }
      await updateConversationAsync({
        ...conversation,
        settings: {
          ...(typeof conversation.settings === 'object'
            ? conversation.settings
            : {}),
          model: model,
        },
        current_message_leaf_id: id,
      });
      await sendToParametricChat({
        model: model,
        messageId: id,
        conversationId: conversation.id,
      });
    },
    onError: (error, { model, id }) => {
      console.error('useRetryMessageMutation', error, {
        conversationId: conversation.id,
        model,
        id,
      });
    },
  });
}

export function useRestoreMessageMutation() {
  const { mutateAsync: insertMessageAsync } = useInsertMessageMutation();

  return useMutation({
    mutationFn: async (messageToRestore: Message) => {
      await insertMessageAsync({
        role: messageToRestore.role,
        content: messageToRestore.content,
        parent_message_id: messageToRestore.parent_message_id ?? null,
        conversation_id: messageToRestore.conversation_id,
      });
    },
    onError: (error, messageToRestore) => {
      console.error('useRestoreMessageMutation', error, messageToRestore);
    },
  });
}

export function useChangeRatingMutation({
  conversationId,
}: {
  conversationId: string;
}) {
  const queryClient = useQueryClient();
  const { mutateAsync: updateMessageOptimistic } =
    useUpdateMessageOptimisticMutation();

  const messages = queryClient.getQueryData<Message[]>([
    'messages',
    conversationId,
  ]);

  return useMutation({
    mutationKey: ['change-rating', conversationId],
    mutationFn: async ({
      messageId,
      rating,
    }: {
      messageId: string;
      rating: number;
    }) => {
      const oldMessage = messages?.find((msg) => msg.id === messageId);
      if (!oldMessage) return;
      updateMessageOptimistic({ message: { ...oldMessage, rating } });
    },
  });
}
