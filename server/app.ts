import express from 'express';
import OpenAI from 'openai';
import { ChatMessage, cleanHistory, classifierPrompt, MOVIE_SYSTEM_PROMPT, OUT_OF_SCOPE_MESSAGE, parseScope } from './guardrail.js';

type CompletionClient = {
  chat: { completions: { create: (body: Record<string, unknown>) => Promise<{ choices: Array<{ message: { content: string | null } }> }> } };
};

export type AppOptions = { client?: CompletionClient; model?: string };

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const client = options.client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL });

  app.post('/api/chat', async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 3000) : '';
    if (!message) return res.status(400).json({ error: 'Hãy nhập câu hỏi trước khi gửi.' });
    const history = cleanHistory(req.body?.history);

    try {
      const classification = await client.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: 'Bạn là bộ phân loại phạm vi chính xác.' }, { role: 'user', content: classifierPrompt(message, history) }],
      });

      if (!parseScope(classification.choices[0]?.message.content)) {
        return res.json({ reply: OUT_OF_SCOPE_MESSAGE, blocked: true });
      }

      const answer = await client.chat.completions.create({
        model,
        temperature: 0.55,
        max_tokens: 650,
        messages: [{ role: 'system', content: MOVIE_SYSTEM_PROMPT }, ...history, { role: 'user', content: message }],
      });
      return res.json({ reply: answer.choices[0]?.message.content?.trim() || 'Mình chưa thể tạo câu trả lời lúc này.', blocked: false });
    } catch (error) {
      console.error('Chat request failed:', error instanceof Error ? error.message : error);
      return res.status(502).json({ error: 'Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.' });
    }
  });

  return app;
}
