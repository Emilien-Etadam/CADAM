import React, {
  useState,
  useRef,
  KeyboardEvent,
  useEffect,
  useCallback,
} from 'react';
import { ArrowUp, Loader2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Content, Model } from '@shared/types';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl } from '@/lib/localBackend';
import { ModelSelector } from '@/components/ModelSelector';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ModelConfig } from '@/types/misc';

interface TextAreaChatProps {
  onSubmit: (content: Content) => void;
  onFocus?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  stopGenerating?: () => void;
  disabled?: boolean;
  model: Model;
  setModel: (model: Model) => void;
  showPromptGenerator?: boolean;
  showFullLabels?: boolean;
  conversation: {
    id: string;
    user_id: string;
  };
  modelConfigs: ModelConfig[];
  modelsLoading?: boolean;
}

export default function TextAreaChat({
  onSubmit,
  onFocus,
  isLoading = false,
  placeholder = 'Start building…',
  stopGenerating,
  disabled = false,
  model,
  setModel,
  showPromptGenerator = true,
  showFullLabels = true,
  conversation,
  modelConfigs,
  modelsLoading = false,
}: TextAreaChatProps) {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || disabled || isLoading) return;
    onSubmit({
      text: input,
      model,
    });
    setInput('');
  }, [input, disabled, isLoading, onSubmit, model]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const generatePrompt = async () => {
    if (isGeneratingPrompt) return;
    setIsGeneratingPrompt(true);
    try {
      const body = {
        existingText: input.trim() || null,
        type: 'parametric' as const,
        model,
      };
      const r = await fetch(`${getApiBaseUrl()}/api/prompt-generator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(r.statusText);
      const data = (await r.json()) as { prompt?: string };
      if (!data?.prompt) throw new Error('No prompt generated');
      setInput(data.prompt);
    } catch (error) {
      console.error('Error generating prompt:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate prompt',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  return (
    <div className="relative w-full max-w-3xl">
      <div className="relative flex flex-col rounded-xl border border-adam-neutral-700 bg-adam-bg-secondary-dark p-2 shadow-sm">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          className="max-h-[40vh] min-h-[120px] resize-none border-0 bg-transparent px-3 py-2 text-sm text-adam-text-primary placeholder:text-adam-neutral-500 focus-visible:ring-0"
          rows={1}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-1 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <ModelSelector
              models={modelConfigs}
              selectedModel={model}
              onModelChange={setModel}
              disabled={disabled || isLoading || modelsLoading}
              type="parametric"
            />
            {showPromptGenerator && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={generatePrompt}
                disabled={disabled || isLoading || isGeneratingPrompt}
              >
                {isGeneratingPrompt ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {showFullLabels && (
                  <span className="hidden sm:inline">Prompt ideas</span>
                )}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLoading && stopGenerating && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                onClick={stopGenerating}
              >
                Stop
              </Button>
            )}
            <Button
              type="button"
              size="icon"
              className={cn(
                'h-9 w-9 rounded-lg',
                input.trim() && !disabled && !isLoading
                  ? 'bg-adam-blue text-white'
                  : 'bg-adam-neutral-800 text-adam-neutral-500',
              )}
              disabled={!input.trim() || disabled || isLoading}
              onClick={handleSubmit}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
