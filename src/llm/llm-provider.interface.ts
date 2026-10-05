export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export interface StructuredRequest {
  system: string;
  context: Record<string, JsonValue>;
  schemaName?: string;
  maxOutputTokens?: number;
  schema: Record<string, unknown>;
}
export interface LlmProvider {
  generateStructured(request: StructuredRequest): Promise<unknown>;
}
