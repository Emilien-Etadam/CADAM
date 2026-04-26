import { useConversation } from '@/contexts/ConversationContext';
import { CREATIVE_MODELS } from '@/lib/utils';
import { Message } from '@shared/types';

export function ModelButton({ message }: { message: Message }) {
  const { conversation } = useConversation();
  let label: string;
  if (conversation.type === 'parametric') {
    const id = message.content.model;
    label = id && id.length > 0 ? id : '—';
  } else {
    const model =
      CREATIVE_MODELS.find((m) => m.id === message.content.model) ||
      CREATIVE_MODELS[0];
    label = model.name;
  }

  return (
    <span className="h-6 w-fit text-nowrap rounded-lg border border-adam-neutral-700 bg-adam-bg-secondary-dark px-2 pb-0.5 pt-1 text-xs text-adam-text-primary transition-all duration-100 ease-in-out">
      {label}
    </span>
  );
}
