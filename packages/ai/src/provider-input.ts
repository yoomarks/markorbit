export const AI_TEXT_GENERATION_INPUT_VERSION = 1 as const;

export type AiTextGenerationOutputFormat = 'TEXT' | 'MARKDOWN' | 'JSON';

export interface AiTextGenerationInputV1 {
  schemaVersion: typeof AI_TEXT_GENERATION_INPUT_VERSION;
  kind: 'TEXT_GENERATION';
  prompt: string;
  systemInstruction?: string;
  outputFormat: AiTextGenerationOutputFormat;
}

export class AiProviderInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderInputError';
  }
}

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new AiProviderInputError(`${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new AiProviderInputError(`${field} must contain 1 to ${maxLength} characters.`);
  }
  return cleaned;
}

export function parseAiTextGenerationInputV1(value: unknown): AiTextGenerationInputV1 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AiProviderInputError('AI text-generation input must be an object.');
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(['schemaVersion', 'kind', 'prompt', 'systemInstruction', 'outputFormat']);
  const unsupported = Object.keys(record).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new AiProviderInputError(
      `AI text-generation input contains unsupported fields: ${unsupported.join(', ')}.`,
    );
  }
  if (record.schemaVersion !== AI_TEXT_GENERATION_INPUT_VERSION) {
    throw new AiProviderInputError(
      `AI text-generation input schemaVersion must be ${AI_TEXT_GENERATION_INPUT_VERSION}.`,
    );
  }
  if (record.kind !== 'TEXT_GENERATION') {
    throw new AiProviderInputError('AI text-generation input kind must be TEXT_GENERATION.');
  }
  if (!['TEXT', 'MARKDOWN', 'JSON'].includes(record.outputFormat as string)) {
    throw new AiProviderInputError('AI text-generation outputFormat is invalid.');
  }
  const systemInstruction =
    record.systemInstruction === undefined
      ? undefined
      : text(record.systemInstruction, 'systemInstruction', 100_000);
  return {
    schemaVersion: AI_TEXT_GENERATION_INPUT_VERSION,
    kind: 'TEXT_GENERATION',
    prompt: text(record.prompt, 'prompt', 1_000_000),
    ...(systemInstruction === undefined ? {} : { systemInstruction }),
    outputFormat: record.outputFormat as AiTextGenerationOutputFormat,
  };
}
