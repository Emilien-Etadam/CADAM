import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Content, Message, Model } from '@shared/types';
import TextAreaChat from '@/components/TextAreaChat';
import { SuggestionPills } from '@/components/chat/SuggestionPills';
import { useIsMobile } from '@/hooks/useIsMobile';
import { AssistantMessage } from '@/components/chat/AssistantMessage';
import { UserMessage } from '@/components/chat/UserMessage';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useConversation } from '@/contexts/ConversationContext';
import { AssistantLoading } from '@/components/chat/AssistantLoading';
import { ChatTitle } from '@/components/chat/ChatTitle';
import { CreateIcon } from '@/components/icons/ui/CreateIcon';
import { ConditionalWrapper } from '@/components/ConditionalWrapper';
import { TreeNode } from '@shared/Tree';
import { useLocalApiModels } from '@/hooks/useLocalApiModels';
import { parametricModelConfigsFromApi } from '@/lib/localLlmModelConfigs';
import { CREATIVE_MODELS } from '@/lib/utils';
import {
  getPersistedLocalLlmModelId,
  setPersistedLocalLlmModelId,
} from '@/lib/localLlmSettings';
import type { ModelConfig } from '@/types/misc';

interface ChatSectionProps {
  messages: TreeNode<Message>[];
  isLoading: boolean;
  onSendMessage?: (content: Content) => void;
  onEdit?: (message: Message) => void;
  stopGenerating?: () => void;
  changeRating?: ({
    messageId,
    rating,
  }: {
    messageId: string;
    rating: number;
  }) => void;
  restoreMessage?: (message: Message) => void;
  retryMessage?: ({ model, id }: { model: Model; id: string }) => void;
}

export function ChatSection({
  messages,
  isLoading,
  onSendMessage,
  onEdit,
  stopGenerating,
  changeRating,
  restoreMessage,
  retryMessage,
}: ChatSectionProps) {
  const isMobile = useIsMobile();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { conversation, updateConversation } = useConversation();
  const navigate = useNavigate();
  const { data: apiModels, isLoading: localModelsLoading } = useLocalApiModels();

  const parametricLlmModelConfigs: ModelConfig[] = useMemo(
    () => parametricModelConfigsFromApi(apiModels),
    [apiModels],
  );

  const chatModelList: ModelConfig[] = useMemo(
    () =>
      conversation.type === 'parametric' ? parametricLlmModelConfigs : CREATIVE_MODELS,
    [conversation.type, parametricLlmModelConfigs],
  );

  const scrollToBottom = useCallback(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []);

  const model = useMemo(() => {
    if (conversation.type === 'parametric') {
      return (
        conversation.settings?.model ??
        getPersistedLocalLlmModelId() ??
        apiModels?.defaultModel ??
        ''
      );
    }
    return conversation.settings?.model ?? 'quality';
  }, [conversation.type, conversation.settings, apiModels?.defaultModel]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isLoading) {
      scrollToBottom();
    }
  }, [isLoading, scrollToBottom]);

  const lastMessage = useMemo(() => {
    if (conversation.current_message_leaf_id) {
      return messages.find(
        (msg) => msg.id === conversation.current_message_leaf_id,
      );
    }
    return messages[messages.length - 1];
  }, [messages, conversation.current_message_leaf_id]);

  const getCurrentVersion = useCallback(
    (index: number) => {
      return messages.slice(0, index + 1).filter((m) => m.role === 'assistant')
        .length;
    },
    [messages],
  );

  const suggestions =
    lastMessage?.content?.artifact?.suggestions ||
    lastMessage?.content?.suggestions ||
    [];

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      const m =
        conversation.type === 'parametric'
          ? (conversation.settings?.model ??
            getPersistedLocalLlmModelId() ??
            apiModels?.defaultModel)
          : conversation.settings?.model;
      onSendMessage?.({ text: suggestion, model: m });
    },
    [
      conversation.type,
      conversation.settings?.model,
      apiModels?.defaultModel,
      onSendMessage,
    ],
  );

  const handleModelChange = useCallback(
    (newModel: Model) => {
      if (conversation.type === 'parametric') {
        setPersistedLocalLlmModelId(newModel);
      }
      if (!updateConversation) return;
      updateConversation({
        ...conversation,
        settings: {
          ...(typeof conversation.settings === 'object'
            ? conversation.settings
            : {}),
          model: newModel,
        },
      });
    },
    [conversation, updateConversation],
  );

  return (
    <div className="flex h-full w-full flex-col items-center overflow-hidden border-r border-neutral-700 bg-adam-bg-secondary-dark dark:border-gray-800">
      <div className="flex w-full items-center justify-between bg-transparent p-3 pl-12 dark:border-gray-800">
        <ConditionalWrapper
          condition={!isMobile}
          wrapper={(children) => (
            <div className="flex min-w-0 flex-1 items-center space-x-2">
              {children}
            </div>
          )}
        >
          <div className="min-w-0 flex-1">
            <ChatTitle />
          </div>
        </ConditionalWrapper>
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-transparent p-0 hover:bg-transparent"
              onClick={() => navigate('/')}
              aria-label="New chat"
            >
              <CreateIcon className="h-5 w-5 text-adam-text-primary" />
            </Button>
          )}
        </div>
      </div>
      <ScrollArea
        className="relative w-full max-w-xl flex-1 px-2 py-0"
        ref={scrollAreaRef}
      >
        <div className="pointer-events-none sticky left-0 top-0 z-50 mr-4 h-3 bg-gradient-to-b from-adam-bg-secondary-dark/90 to-transparent" />
        <div className="space-y-4 pb-6">
          {messages.map((message, index) => {
            return (
              <div className="p-1" key={message.id}>
                {message.role === 'assistant' ? (
                  <AssistantMessage
                    message={message}
                    changeRating={changeRating}
                    isLoading={isLoading}
                    currentVersion={getCurrentVersion(index)}
                    restoreMessage={restoreMessage}
                    limitReached={false}
                    onRetry={retryMessage}
                  />
                ) : (
                  <UserMessage
                    message={message}
                    onEdit={onEdit}
                    isLoading={isLoading}
                    limitReached={false}
                  />
                )}
              </div>
            );
          })}
          {isLoading && lastMessage?.role !== 'assistant' && (
            <AssistantLoading />
          )}
        </div>
      </ScrollArea>
      {onSendMessage && (
        <div className="w-full min-w-52 max-w-xl bg-transparent px-4 pb-6">
          <SuggestionPills
            disabled={false}
            suggestions={suggestions}
            onSelect={handleSuggestionSelect}
          />
          <TextAreaChat
            stopGenerating={stopGenerating}
            onSubmit={onSendMessage}
            placeholder="Keep iterating…"
            isLoading={isLoading}
            disabled={false}
            model={model}
            setModel={handleModelChange}
            conversation={conversation}
            modelConfigs={chatModelList}
            modelsLoading={
              conversation.type === 'parametric' && localModelsLoading
            }
          />
        </div>
      )}
    </div>
  );
}
