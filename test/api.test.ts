import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { OUT_OF_SCOPE_MESSAGE } from '../server/guardrail.js';

function fakeClient(scope: boolean) {
  let calls = 0;
  return { chat: { completions: { create: async () => ({ choices: [{ message: { content: ++calls === 1 ? JSON.stringify({ inScope: scope }) : 'Một câu trả lời về phim.' } }] }) } } };
}

describe('POST /api/chat', () => {
  it('blocks an out-of-scope request before generating an answer', async () => {
    const response = await request(createApp({ client: fakeClient(false) })).post('/api/chat').send({ message: 'Tôi nên mua cổ phiếu nào?' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ reply: OUT_OF_SCOPE_MESSAGE, blocked: true, usage: { total: 0 } });
  });

  it('returns a movie answer and sanitizes oversized history', async () => {
    const app = createApp({ client: fakeClient(true) });
    const response = await request(app).post('/api/chat').send({ message: 'Phân tích nhân vật Furiosa', history: Array.from({ length: 9 }, () => ({ role: 'user', content: 'x' })) });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ reply: 'Một câu trả lời về phim.', blocked: false, usage: { total: 0 } });
  });


  it('streams answer chunks and total token usage', async () => {
    let calls = 0;
    const streamedClient = { chat: { completions: { create: async () => {
      calls += 1;
      if (calls === 1) return { choices: [{ message: { content: '{"inScope":true}' } }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } };
      return (async function* () {
        yield { choices: [{ delta: { content: 'Một câu ' } }] };
        yield { choices: [{ delta: { content: 'trả lời* mượt.' } }] };
        yield { choices: [], usage: { prompt_tokens: 8, completion_tokens: 5, total_tokens: 13 } };
      })();
    } } } };
    const response = await request(createApp({ client: streamedClient })).post('/api/chat/stream').send({ message: 'Gợi ý phim' });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('event: status');
    expect(response.text).toContain('Một câu ');
    expect(response.text).toContain('trả lời mượt.');
    expect(response.text).toContain('"total":17');
    expect(response.text).toContain('"latencyMs":');
  });

  it('returns a safe API error when the model is unavailable', async () => {
    const broken = { chat: { completions: { create: async () => { throw new Error('secret upstream detail'); } } } };
    const response = await request(createApp({ client: broken })).post('/api/chat').send({ message: 'Gợi ý phim' });
    expect(response.status).toBe(502);
    expect(response.body.error).toBe('Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.');
  });
});
