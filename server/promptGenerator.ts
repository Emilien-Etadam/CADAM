import { corsHeaders } from './db.js';
import {
  CHAT_COMPLETIONS_URL,
  OPENAI_API_KEY,
  resolveLocalLlmModel,
} from './lib/localOpenAiModel.js';

const MAX_TOKENS_CAP = parseInt(process.env.MAX_TOKENS_CAP ?? '4096', 10);

const PROMPT_SYSTEM_PROMPT = `You are a helpful assistant that generates creative prompts for organic 3D forms and artistic objects. Your prompts should be:
1. Focus on organic shapes, characters, figurines, and artistic forms
2. Be short and creative
3. Avoid technical dimensions - focus on form and aesthetics
4. Think sculptures, characters, animals, artistic objects
5. Return ONLY the prompt text without any introductory phrases or quotes

Here are some examples:

User: "Generate a creative prompt for a 3D form."
Assistant: "a table top figurine of sonic the hedgehog"
User: "Generate a creative prompt for a 3D form."
Assistant: "a dragon sculpture with spread wings"
User: "Generate a creative prompt for a 3D form."
Assistant: "a decorative elephant statue"
User: "Generate a creative prompt for a 3D form."
Assistant: "a cartoon character bust of mario"
User: "Generate a creative prompt for a 3D form."
Assistant: "a stylized tree with twisted branches"
User: "Generate a creative prompt for a 3D form."
Assistant: "a miniature castle with towers"
`;

const PARAMETRIC_SYSTEM_PROMPT = `You are a helpful assistant that generates prompts for dimensional household objects and functional parts. Your prompts should be:
1. Focus on practical household items and functional parts
2. Include specific dimensions when relevant
3. Be concise and practical
4. Think containers, holders, brackets, everyday objects
5. Return ONLY the prompt text without any introductory phrases or quotes

Here are some examples:

User: "Generate a parametric modeling prompt."
Assistant: "a plant pot with 4 drainage holes and a 30mm diameter"
User: "Generate a parametric modeling prompt."
Assistant: "a phone stand with 15 degree angle and cable slot"
User: "Generate a parametric modeling prompt."
Assistant: "a pen holder cup 80mm diameter with pencil slots"
User: "Generate a parametric modeling prompt."
Assistant: "a wall bracket 120mm wide with two 6mm screw holes"
User: "Generate a parametric modeling prompt."
Assistant: "a drawer organizer tray 200x100mm with compartments"
User: "Generate a parametric modeling prompt."
Assistant: "a cable management clip for 8mm cables"
`;

export async function handlePromptGeneratorRequest(
  body: Record<string, unknown>,
): Promise<Response> {
  const {
    existingText,
    type,
    model,
  } = body as {
    existingText?: string;
    type?: 'parametric' | 'creative';
    model?: unknown;
  };

  try {
    const llmModel = await resolveLocalLlmModel(model);
    let systemPrompt: string;
    let userPrompt: string;

    if (existingText && existingText.length > 0) {
      if (type === 'parametric') {
        systemPrompt = `You are a technical writing assistant specialized in enhancing prompts for dimensional household objects and functional parts. When given an existing prompt, you should:

1. Add specific dimensions (in mm) where practical and missing
2. Include functional details like holes, slots, angles, or compartments
3. Focus on practical household use cases and functionality
4. Make it more precise for creating useful everyday objects
5. Maintain the original intent and core concept
6. Keep it concise and practical
7. Return ONLY the enhanced prompt text without any introductory phrases, explanations, or quotes

The enhanced prompt should be more functional and dimensional while staying true to the user's vision.`;

        userPrompt = `Please enhance and expand this household object prompt to make it more functional, dimensional, and practical for everyday use:

${JSON.stringify(existingText)}

Return only the enhanced prompt text, no introductory phrases.`;
      } else {
        systemPrompt = `You are a creative writing assistant specialized in enhancing prompts for 3D game assets and 3D printable characters. When given an existing prompt, you should:

1. Expand with more vivid artistic and organic details
2. Add character traits, poses, or artistic styling
3. Include sculptural or decorative elements
4. Focus on form, aesthetics, and visual appeal
5. Maintain the original intent and core concept
6. Make it more engaging and visually interesting
7. Return ONLY the enhanced prompt text without any introductory phrases, explanations, or quotes

The enhanced prompt should be more artistic and visually compelling while staying true to the user's vision.`;

        userPrompt = `Please enhance and expand this artistic 3D form prompt to make it more detailed, creative, and visually compelling:

${JSON.stringify(existingText)}

Return only the enhanced prompt text, no introductory phrases.`;
      }
    } else {
      if (type === 'parametric') {
        systemPrompt = PARAMETRIC_SYSTEM_PROMPT;
        userPrompt = 'Generate a parametric modeling prompt.';
      } else {
        systemPrompt = PROMPT_SYSTEM_PROMPT;
        userPrompt = 'Generate a creative prompt for a 3D form.';
      }
    }

    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: llmModel,
        max_tokens: Math.min(200, MAX_TOKENS_CAP),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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

    let prompt = '';
    const msgContent = data.choices?.[0]?.message?.content;
    if (typeof msgContent === 'string') {
      prompt = msgContent.trim();
    }

    return new Response(JSON.stringify({ prompt }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error calling prompt model:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
}
