import express, { Response } from 'express';
import OpenAI from 'openai';
import { cleanHistory, classifierPrompt, MOVIE_SYSTEM_PROMPT, OUT_OF_SCOPE_MESSAGE, parseScope } from './guardrail.js';

type CompletionResult = {
  choices: Array<{ message?: { content?: string | null }; delta?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
};
type CompletionClient = {
  chat: { completions: { create: (body: Record<string, unknown>) => Promise<unknown> } };
};
type TokenUsage = { input: number; output: number; total: number };

export type AppOptions = { client?: CompletionClient; model?: string };

function usageFrom(value: CompletionResult['usage']): TokenUsage {
  const input = value?.prompt_tokens ?? 0;
  const output = value?.completion_tokens ?? 0;
  return { input, output, total: value?.total_tokens ?? input + output };
}

function combineUsage(...values: TokenUsage[]): TokenUsage {
  return values.reduce((total, value) => ({ input: total.input + value.input, output: total.output + value.output, total: total.total + value.total }), { input: 0, output: 0, total: 0 });
}

function sendEvent(response: Response, event: string, data: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function requestData(body: unknown) {
  const value = body as { message?: unknown; history?: unknown };
  const message = typeof value?.message === 'string' ? value.message.trim().slice(0, 3000) : '';
  return { message, history: cleanHistory(value?.history) };
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

  app.post('/api/chat', async (req, res) => {
    const { message, history } = requestData(req.body);
    if (!message) return res.status(400).json({ error: 'Hãy nhập câu hỏi trước khi gửi.' });

    try {
      const classification = await client.chat.completions.create({
        model, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Bạn là bộ phân loại phạm vi chính xác.' }, { role: 'user', content: classifierPrompt(message, history) }],
      }) as CompletionResult;
      const classifierUsage = usageFrom(classification.usage);

      if (!parseScope(classification.choices[0]?.message?.content)) {
        return res.json({ reply: OUT_OF_SCOPE_MESSAGE, blocked: true, usage: classifierUsage });
      }

      const answer = await client.chat.completions.create({
        model, temperature: 0.55, max_tokens: 650,
        messages: [{ role: 'system', content: MOVIE_SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],
      }) as CompletionResult;
      return res.json({ reply: (answer.choices[0]?.message?.content ?? '').replaceAll('*', '').trim() || 'Mình chưa thể tạo câu trả lời lúc này.', blocked: false, usage: combineUsage(classifierUsage, usageFrom(answer.usage)) });
    } catch (error) {
      console.error('Chat request failed:', error instanceof Error ? error.message : error);
      return res.status(502).json({ error: 'Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.' });
    }
  });

  app.post('/api/chat/stream', async (req, res) => {
    const { message, history } = requestData(req.body);
    if (!message) return res.status(400).json({ error: 'Hãy nhập câu hỏi trước khi gửi.' });
    const startedAt = performance.now();

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': stream-open\n\n');

    try {
      sendEvent(res, 'status', { stage: 'scope-check' });
      const classification = await client.chat.completions.create({
        model, temperature: 0, response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Bạn là bộ phân loại phạm vi chính xác.' }, { role: 'user', content: classifierPrompt(message, history) }],
      }) as CompletionResult;
      const classifierUsage = usageFrom(classification.usage);

      if (!parseScope(classification.choices[0]?.message?.content)) {
        sendEvent(res, 'delta', { text: OUT_OF_SCOPE_MESSAGE });
        sendEvent(res, 'usage', classifierUsage);
        sendEvent(res, 'done', { blocked: true, latencyMs: Math.round(performance.now() - startedAt) });
        return res.end();
      }

      const stream = await client.chat.completions.create({
        model, temperature: 0.55, max_tokens: 650, stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: 'system', content: MOVIE_SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],
      }) as AsyncIterable<CompletionResult>;
      let answerUsage: TokenUsage = { input: 0, output: 0, total: 0 };

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content?.replaceAll('*', '') ?? '';
        if (text) sendEvent(res, 'delta', { text });
        if (chunk.usage) answerUsage = usageFrom(chunk.usage);
      }

      sendEvent(res, 'usage', combineUsage(classifierUsage, answerUsage));
      sendEvent(res, 'done', { blocked: false, latencyMs: Math.round(performance.now() - startedAt) });
      return res.end();
    } catch (error) {
      console.error('Streaming chat request failed:', error instanceof Error ? error.message : error);
      sendEvent(res, 'error', { error: 'Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.', latencyMs: Math.round(performance.now() - startedAt) });
      return res.end();
    }
  });

  return app;
}
