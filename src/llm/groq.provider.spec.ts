import { GroqProvider } from './groq.provider';
import { InterviewEvaluationService } from '../sessions/interview-evaluation.service';
import { HeuristicEvaluationService } from '../sessions/heuristic-evaluation.service';
const request = {
  system: 'evaluate',
  context: { transcript: 'answer' },
  schema: { type: 'object' },
};
const output = { score: 80, feedback: 'Good', strengths: [], improvements: [] };
const input = {
  question: 'Q',
  idealAnswer: 'A',
  transcript: 'Answer',
  role: 'Backend',
  difficulty: 'Easy',
  questionType: 'technical',
};
describe('GroqProvider', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<
    ReturnType<typeof fetch>,
    Parameters<typeof fetch>
  >();
  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-key';
    process.env.LLM_TIMEOUT_MS = '100';
    process.env.LLM_MAX_RETRIES = '1';
    global.fetch = fetchMock;
    fetchMock.mockReset();
  });
  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });
  const success = () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            finish_reason: 'stop',
            message: { content: JSON.stringify(output) },
          },
        ],
      }),
      { status: 200 },
    );
  it('requests strict JSON and parses a valid response', async () => {
    fetchMock.mockResolvedValue(success());
    expect(await new GroqProvider().generateStructured(request)).toEqual(
      output,
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      response_format: { json_schema: { strict: boolean } };
    };
    expect(body.response_format.json_schema.strict).toBe(true);
  });
  it('uses the requested output budget and resume schema name', async () => {
    fetchMock.mockResolvedValue(success());
    await new GroqProvider().generateStructured({
      ...request,
      schemaName: 'resume_profile',
      maxOutputTokens: 3000,
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string) as {
      max_completion_tokens: number;
      response_format: { json_schema: { name: string } };
    };
    expect(body.max_completion_tokens).toBe(3000);
    expect(body.response_format.json_schema.name).toBe('resume_profile');
  });
  it('sanitizes malformed JSON and timeouts while reading the response body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{private malformed content', { status: 200 }),
    );
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_invalid_response');
    fetchMock.mockResolvedValueOnce(new Response('null', { status: 200 }));
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_invalid_response');
    fetchMock.mockImplementation((_url, opts) =>
      Promise.resolve({
        ok: true,
        json: () =>
          new Promise((_resolve, reject) => {
            opts?.signal?.addEventListener('abort', () =>
              reject(new Error('private provider details')),
            );
          }),
      } as Response),
    );
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_timeout');
  });
  it('retries a transient failure once', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(success());
    expect(await new GroqProvider().generateStructured(request)).toEqual(
      output,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('never retries permanent failures', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_http_error:401');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('classifies Groq JSON-validation rejections without leaking failed generation or messages', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'json_validate_failed',
            message: 'PRIVATE PROVIDER PROMPT',
            failed_generation: 'PRIVATE GENERATED DATA',
          },
        }),
        { status: 400 },
      ),
    );
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_invalid_response');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    JSON.stringify({
      error: { code: 'invalid_request', message: 'PRIVATE CONTENT' },
    }),
    '<private non-JSON error>',
  ])('keeps other 400 errors permanent and sanitized', async (body) => {
    fetchMock.mockResolvedValue(new Response(body, { status: 400 }));
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_http_error:400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('reports truncation separately without exposing response contents', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'length',
              message: { content: 'private partial provider output' },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_output_limit');
  });
  it('limits network retries to one', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    await expect(
      new GroqProvider().generateStructured(request),
    ).rejects.toThrow('provider_network_error');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('uses fallback for malformed provider JSON', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: '{broken' } }],
        }),
        { status: 200 },
      ),
    );
    const service = new InterviewEvaluationService(
      new GroqProvider(),
      new HeuristicEvaluationService(),
    );
    expect((await service.evaluateAnswer(input)).evaluationSource).toBe(
      'heuristic_fallback',
    );
  });
  it('aborts on timeout and falls back without retrying', async () => {
    fetchMock.mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    );
    const service = new InterviewEvaluationService(
      new GroqProvider(),
      new HeuristicEvaluationService(),
    );
    expect((await service.evaluateAnswer(input)).evaluationSource).toBe(
      'heuristic_fallback',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
