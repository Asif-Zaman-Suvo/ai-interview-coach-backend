import { Injectable } from '@nestjs/common';
import type { LlmProvider, StructuredRequest } from './llm-provider.interface';

/** No provider error bodies are propagated: they can contain prompt data. */
@Injectable()
export class GroqProvider implements LlmProvider {
  private readonly key = process.env.GROQ_API_KEY?.trim();
  private readonly model =
    process.env.LLM_MODEL?.trim() || 'openai/gpt-oss-20b';
  private readonly timeout = Number(process.env.LLM_TIMEOUT_MS || 15000);
  private readonly retries = Number(process.env.LLM_MAX_RETRIES || 1);

  constructor() {
    if (
      !Number.isInteger(this.timeout) ||
      this.timeout < 1 ||
      !Number.isInteger(this.retries) ||
      this.retries < 0 ||
      this.retries > 1
    ) {
      throw new Error('Invalid LLM timeout/retry configuration');
    }
  }

  async generateStructured(request: StructuredRequest): Promise<unknown> {
    if (!this.key) throw new Error('provider_not_configured');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      for (let attempt = 0; attempt <= this.retries; attempt++) {
        let response: Response;
        try {
          response = await fetch(
            'https://api.groq.com/openai/v1/chat/completions',
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                Authorization: `Bearer ${this.key}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: this.model,
                messages: [
                  { role: 'system', content: request.system },
                  { role: 'user', content: JSON.stringify(request.context) },
                ],
                max_completion_tokens: request.maxOutputTokens ?? 1500,
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: request.schemaName ?? 'interview_evaluation',
                    strict: true,
                    schema: request.schema,
                  },
                },
              }),
            },
          );
        } catch {
          if (controller.signal.aborted) throw new Error('provider_timeout');
          if (attempt < this.retries) continue;
          throw new Error('provider_network_error');
        }
        if (!response.ok) {
          if (response.status === 400) {
            // Groq can reject a completion that fails its JSON-schema checks.
            // Classify only its known code; never propagate failed_generation or messages.
            const body: unknown = await response.json().catch(() => null);
            if (body && typeof body === 'object' && 'error' in body) {
              const detail: unknown = body.error;
              if (
                detail &&
                typeof detail === 'object' &&
                'code' in detail &&
                detail.code === 'json_validate_failed'
              ) {
                throw new Error('provider_invalid_response');
              }
            }
          }
          if (!response.bodyUsed) await response.body?.cancel();
          if (
            (response.status === 429 || response.status >= 500) &&
            attempt < this.retries
          )
            continue;
          throw new Error(`provider_http_error:${response.status}`);
        }
        const data = (await response.json().catch(() => {
          throw new Error(
            controller.signal.aborted
              ? 'provider_timeout'
              : 'provider_invalid_response',
          );
        })) as {
          choices?: {
            finish_reason?: string;
            message?: { content?: string; refusal?: string };
          }[];
        };
        if (!data || !Array.isArray(data.choices)) {
          throw new Error('provider_invalid_response');
        }
        const choice = data.choices[0];
        if (choice?.finish_reason === 'length') {
          throw new Error('provider_output_limit');
        }
        if (
          choice?.finish_reason !== 'stop' ||
          choice.message?.refusal ||
          !choice.message?.content
        ) {
          throw new Error('provider_invalid_response');
        }
        return JSON.parse(choice.message.content) as unknown;
      }
      throw new Error('provider_unavailable');
    } catch (error) {
      // Abort can also occur while reading the response body. Never expose parse errors.
      if (controller.signal.aborted) throw new Error('provider_timeout');
      if (error instanceof SyntaxError)
        throw new Error('provider_invalid_response');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
