/**
 * Multi-provider AI adapter for brainstorming.
 *
 * Supported providers (configured in plan.yaml under `ai:`):
 *   anthropic      — Anthropic Claude  (env: ANTHROPIC_API_KEY)
 *   openai         — OpenAI            (env: OPENAI_API_KEY)
 *   github-copilot — GitHub Copilot    (env: GITHUB_TOKEN)
 *   ollama         — Ollama local      (no key needed, http://localhost:11434)
 *   none           — disabled
 */

function buildPrompt(pillar, plan) {
  const taskList = pillar.tasks
    .map((t) => `  - [${t.id}] ${t.title} (status: ${t.status}, eval: ${t.evaluation}, deps: ${t.dependencies?.join(', ') || 'none'})`)
    .join('\n');

  return `You are a technical planning assistant helping an engineering team create a long-term roadmap.

## Plan Context
**Title:** ${plan.meta.title}
**Owner:** ${plan.meta.owner}

**Current State:**
${plan.current_state}

**Target State:**
${plan.target_state}

## Pillar: ${pillar.name}
${pillar.description ? `Description: ${pillar.description}` : ''}

### Existing Tasks
${taskList || '(none yet)'}

## Your Task
Please suggest improvements to this pillar's task list. Respond in the following JSON format ONLY (no markdown wrapper, just raw JSON):

{
  "suggestions": [
    {
      "title": "Task title",
      "description": "Brief description of what this task involves",
      "priority": "high|medium|low",
      "rationale": "Why this task is important",
      "suggested_dependencies": ["existing-task-id-if-applicable"]
    }
  ],
  "dependency_suggestions": [
    {
      "from": "existing-task-id",
      "to": "existing-task-id",
      "reason": "Why this dependency makes sense"
    }
  ],
  "risks": [
    "Risk or blocker to be aware of"
  ]
}

Provide 3-5 new task suggestions that are specific, actionable, and relevant to moving from current state to target state. Keep titles concise (under 60 chars).`;
}

async function callAnthropic(prompt, model) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text;
}

async function callOpenAI(prompt, model, baseURL, apiKey) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ baseURL, apiKey });
  const resp = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2048,
  });
  return resp.choices[0].message.content;
}

export async function brainstorm(pillar, plan) {
  const aiConfig = plan.ai || { provider: 'none' };
  const { provider, model } = aiConfig;

  const prompt = buildPrompt(pillar, plan);

  let rawText;
  switch (provider) {
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
      }
      rawText = await callAnthropic(prompt, model || 'claude-sonnet-4-6');
      break;

    case 'openai':
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY environment variable is not set.');
      }
      rawText = await callOpenAI(prompt, model || 'gpt-4o', undefined, process.env.OPENAI_API_KEY);
      break;

    case 'github-copilot':
      if (!process.env.GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN environment variable is not set.');
      }
      rawText = await callOpenAI(
        prompt,
        model || 'gpt-4o',
        'https://models.inference.ai.azure.com',
        process.env.GITHUB_TOKEN
      );
      break;

    case 'ollama': {
      const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      rawText = await callOpenAI(prompt, model || 'llama3.2', ollamaBase, 'ollama');
      break;
    }

    case 'none':
    default:
      throw new Error(
        'AI provider is set to "none". Update the `ai.provider` field in your plan.yaml to enable brainstorming.'
      );
  }

  // Parse JSON response
  try {
    // Strip potential markdown code fences
    const cleaned = rawText.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    return JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse AI response as JSON. Raw response:\n${rawText}`);
  }
}
