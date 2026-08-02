import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { loadAiConfig } from '@/lib/ai/config'
import { generateReply } from '@/lib/ai/generate'
import { AiError } from '@/lib/ai/types'

/**
 * POST /api/ai/generate-automation
 *
 * Body: { prompt: string }
 * Returns: { automation: { name, description, trigger_type, trigger_config, steps[] } }
 *
 * Uses the account's configured AI provider to generate a complete automation
 * definition from a natural-language prompt. The returned object is validated
 * against the list of known trigger/step types before being returned.
 */

const KNOWN_TRIGGER_TYPES = [
  'new_message_received',
  'first_inbound_message',
  'keyword_match',
  'interactive_reply',
  'new_contact_created',
  'conversation_assigned',
  'tag_added',
  'time_based',
] as const

const KNOWN_STEP_TYPES = [
  'send_message',
  'send_buttons',
  'send_list',
  'send_template',
  'add_tag',
  'remove_tag',
  'assign_conversation',
  'update_contact_field',
  'create_deal',
  'wait',
  'condition',
  'send_webhook',
  'close_conversation',
] as const

const AUTOMATION_GENERATION_SYSTEM_PROMPT = `You are an automation builder for a WhatsApp CRM called Centro do Sorriso. Your job is to take a natural-language description from the user and produce a valid JSON automation definition.

You MUST respond with ONLY a valid JSON object — no explanations, no markdown code blocks, no preamble. Just raw JSON.

## JSON Schema

\`\`\`json
{
  "name": "string (short, descriptive name for the automation, max 60 chars)",
  "description": "string (one sentence describing what it does, max 120 chars)",
  "trigger_type": "one of the trigger types listed below",
  "trigger_config": { ... depends on trigger_type ... },
  "steps": [ ... array of step objects ... ]
}
\`\`\`

## Available Trigger Types

- **new_message_received**: Any incoming WhatsApp message. trigger_config: {}
- **first_inbound_message**: First ever message from a contact. trigger_config: {}
- **keyword_match**: Message contains specific keywords. trigger_config: { "keywords": ["word1", "word2"], "match_type": "contains" }
- **interactive_reply**: Customer tapped a button/list row. trigger_config: { "reply_ids": ["btn_id1", "btn_id2"] }
- **new_contact_created**: When a new contact is auto-created. trigger_config: {}
- **conversation_assigned**: When assigned to an agent. trigger_config: {}
- **tag_added**: When a tag is added to a contact. trigger_config: { "tag_id": "" }
- **time_based**: Recurring schedule. trigger_config: { "schedule": "0 9 * * 1-5" }

## Available Step Types

Each step has "step_type" and "step_config":

- **send_message**: { "text": "Your message here" }
- **add_tag**: { "tag_id": "" }
- **remove_tag**: { "tag_id": "" }
- **assign_conversation**: { "mode": "round_robin" } or { "mode": "specific", "agent_id": "" }
- **update_contact_field**: { "field": "name|email|company", "value": "value or {{vars.x}}" }
- **create_deal**: { "pipeline_id": "", "stage_id": "", "title": "Deal title" }
- **wait**: { "amount": 10, "unit": "minutes|hours|days" }
- **condition**: { "subject": "tag_presence|contact_field|message_content|time_of_day", "operand": "...", "value": "..." }
- **send_template**: { "template_name": "template_name_here", "language": "pt_BR" }
- **close_conversation**: {}
- **send_webhook**: { "url": "https://...", "headers": {}, "body_template": "{}" }

## Rules

1. Choose the most appropriate trigger for the user's intent
2. Generate realistic, useful step configs — use descriptive message text in Portuguese
3. For condition steps, subsequent steps can be wrapped in branches; but since the JSON format is flat steps array, just include the condition step and the steps that follow (the UI will handle branching visually)
4. Keep steps minimal and focused — 1 to 5 steps is ideal
5. For keyword_match, generate realistic Portuguese keywords
6. If the user mentions time-based triggering, use "time_based" with a reasonable cron expression
7. Leave tag_id, agent_id, pipeline_id, stage_id as empty strings "" — the user will fill those in the builder
8. Generate the name and description in the same language as the user's prompt

## Example Input → Output

Input: "Quando receber a palavra 'preço', envie uma mensagem perguntando o interesse"

Output:
{"name":"Resposta a Consulta de Preço","description":"Responde automaticamente quando um contato pergunta sobre preços.","trigger_type":"keyword_match","trigger_config":{"keywords":["preço","preco","valor","custo","quanto"],"match_type":"contains"},"steps":[{"step_type":"send_message","step_config":{"text":"Olá! 😊 Fico feliz em ajudar com informações sobre preços. Poderia me contar um pouco mais sobre o que você está procurando para eu te passar os melhores valores?"}}]}
`

function validateAutomationJson(data: unknown): { valid: boolean; error?: string } {
  if (typeof data !== 'object' || data === null) {
    return { valid: false, error: 'Response is not an object' }
  }

  const obj = data as Record<string, unknown>

  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    return { valid: false, error: 'Missing or invalid "name"' }
  }

  if (!KNOWN_TRIGGER_TYPES.includes(obj.trigger_type as never)) {
    return { valid: false, error: `Invalid trigger_type: ${obj.trigger_type}` }
  }

  if (!Array.isArray(obj.steps) || obj.steps.length === 0) {
    return { valid: false, error: 'steps must be a non-empty array' }
  }

  for (let i = 0; i < obj.steps.length; i++) {
    const step = obj.steps[i] as Record<string, unknown>
    if (!KNOWN_STEP_TYPES.includes(step.step_type as never)) {
      return { valid: false, error: `Invalid step_type at index ${i}: ${step.step_type}` }
    }
    if (typeof step.step_config !== 'object' || step.step_config === null) {
      return { valid: false, error: `steps[${i}].step_config must be an object` }
    }
  }

  return { valid: true }
}

function extractJson(raw: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(raw.trim())
  } catch {
    // Fall back: extract JSON from potential markdown code block
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        return JSON.parse(match[1].trim())
      } catch {
        // ignore
      }
    }
    // Last resort: find first { ... } block
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1))
      } catch {
        // ignore
      }
    }
    throw new Error('Could not extract valid JSON from AI response')
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('agent')

    // Rate-limit: 10 generations per user per minute (half of aiDraft budget)
    const userLimit = checkRateLimit(`ai-gen-auto:${userId}`, { limit: 10, windowMs: 60_000 })
    if (!userLimit.success) return rateLimitResponse(userLimit)

    const body = await request.json().catch(() => null)
    const prompt = body && typeof body.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }
    if (prompt.length > 1000) {
      return NextResponse.json(
        { error: 'prompt must be 1000 characters or fewer' },
        { status: 400 },
      )
    }

    const config = await loadAiConfig(supabase, accountId, { requireActive: false }).catch(
      (err) => {
        console.error('[ai/generate-automation] loadAiConfig error:', err)
        throw new AiError('Stored API key could not be decrypted.', {
          code: 'key_decrypt_failed',
          status: 400,
        })
      },
    )

    if (!config) {
      return NextResponse.json(
        {
          error:
            'Assistente de IA não configurado. Ative-o em Configurações → Agente IA.',
          code: 'ai_not_configured',
        },
        { status: 400 },
      )
    }

    const messages = [{ role: 'user' as const, content: prompt }]

    const { text: rawText } = await generateReply({
      config,
      systemPrompt: AUTOMATION_GENERATION_SYSTEM_PROMPT,
      messages,
    })

    let parsed: unknown
    try {
      parsed = extractJson(rawText)
    } catch {
      console.error('[ai/generate-automation] Failed to parse AI response:', rawText.slice(0, 500))
      return NextResponse.json(
        {
          error:
            'A IA retornou uma resposta inválida. Tente reformular o prompt e tente novamente.',
          code: 'parse_failed',
        },
        { status: 422 },
      )
    }

    const validation = validateAutomationJson(parsed)
    if (!validation.valid) {
      console.error('[ai/generate-automation] Validation failed:', validation.error, parsed)
      return NextResponse.json(
        {
          error: `A automação gerada pela IA é inválida: ${validation.error}. Tente um prompt mais específico.`,
          code: 'validation_failed',
        },
        { status: 422 },
      )
    }

    return NextResponse.json({ automation: parsed })
  } catch (err) {
    if (err instanceof AiError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      )
    }
    return toErrorResponse(err)
  }
}
