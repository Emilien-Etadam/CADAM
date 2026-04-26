import { useNavigate, useOutletContext } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveUserId } from '@/lib/localUser';
import { apiCreateConversation, apiPatchConversation } from '@/services/localDataApi';
import TextAreaChat from '@/components/TextAreaChat';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useLocalApiModels } from '@/hooks/useLocalApiModels';
import { Content, Conversation, Model } from '@shared/types';
import { cn } from '@/lib/utils';
import { makeUuid } from '@/lib/uuid';
import { parametricModelConfigsFromApi } from '@/lib/localLlmModelConfigs';
import {
  getPersistedLocalLlmModelId,
  setPersistedLocalLlmModelId,
} from '@/lib/localLlmSettings';
import { generateConversationTitle } from '@/services/conversationService';
import { useSendContentMutation } from '@/services/messageService';

export function PromptView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isSidebarOpen } = useOutletContext<{ isSidebarOpen: boolean }>();
  const queryClient = useQueryClient();
  const { data: apiModels, isLoading: modelsLoading } = useLocalApiModels();

  const [model, setModel] = useState<Model>('');
  const [isLoaded, setIsLoaded] = useState(false);
  const isMobile = useIsMobile();

  const homeModelConfigs = useMemo(
    () => parametricModelConfigsFromApi(apiModels),
    [apiModels],
  );

  useEffect(() => {
    if (model) return;
    const stored = getPersistedLocalLlmModelId();
    if (stored) {
      setModel(stored);
      return;
    }
    if (apiModels?.defaultModel) {
      setModel(apiModels.defaultModel);
    }
  }, [apiModels?.defaultModel, model]);

  const setModelWithPersist = useCallback((m: Model) => {
    setPersistedLocalLlmModelId(m);
    setModel(m);
  }, []);

  const newConversationId = useMemo(() => makeUuid(), []);

  const { mutate: sendMessage } = useSendContentMutation({
    conversation: {
      id: newConversationId,
      user_id: getEffectiveUserId(user?.id) ?? '',
      type: 'parametric',
      settings: { model: model },
      current_message_leaf_id: null,
    },
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsLoaded(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const getTimeBasedGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const { mutate: handleGenerate } = useMutation({
    mutationFn: async (content: Content) => {
      const conversation = await apiCreateConversation({
        id: newConversationId,
        title: 'New Conversation',
        type: 'parametric',
        settings: { model: model },
      });
      sendMessage(content);
      return { conversationId: conversation.id, content };
    },
    onSuccess: (data) => {
      generateConversationTitle(data.conversationId, data.content)
        .then((title) => {
          if (!title) return;
          void apiPatchConversation(data.conversationId, { title });
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          queryClient.setQueryData(
            ['conversation', data.conversationId],
            (oldConversation: Conversation) => ({
              ...oldConversation,
              title,
            }),
          );
        })
        .catch((error) => {
          console.error('Error generating title:', error);
        });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate(`/editor/${data.conversationId}`);
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to process prompt',
        variant: 'destructive',
      });
    },
  });

  const firstName =
    user?.email?.split('@')[0]?.trim().split(/\s+/)[0] ?? '';

  return (
    <div
      className={cn(
        'relative h-full min-h-full w-full transition-all duration-300 ease-in-out',
        isSidebarOpen && !isMobile && user?.id && 'pb-6 pr-6 pt-6',
      )}
    >
      <div
        className={cn(
          'h-full min-h-full bg-adam-bg-secondary-dark',
          isSidebarOpen &&
            !isMobile &&
            user?.id &&
            'rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)]',
        )}
      >
        <main className="flex h-full w-full flex-col items-center justify-center px-4 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-center">
            <h1
              className={cn(
                'mb-8 text-center text-2xl font-medium text-adam-text-primary md:text-3xl lg:text-4xl',
                'motion-safe:transition-opacity motion-safe:duration-1000 motion-safe:ease-out',
                isLoaded ? 'opacity-100' : 'opacity-0',
              )}
            >
              {getTimeBasedGreeting}
              {firstName ? `, ${firstName}` : ''}!
            </h1>
          </div>
          <div className="flex w-full flex-col items-center">
            <div className="w-full max-w-3xl space-y-4 pb-12">
              <TextAreaChat
                onSubmit={handleGenerate}
                conversation={{
                  id: newConversationId,
                  user_id: user?.id ?? '',
                }}
                model={model}
                setModel={setModelWithPersist}
                modelConfigs={homeModelConfigs}
                modelsLoading={modelsLoading}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
