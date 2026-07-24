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
    expect(response.body).toEqual({ reply: OUT_OF_SCOPE_MESSAGE, blocked: true });
  });

  it('returns a movie answer and sanitizes oversized history', async () => {
    const app = createApp({ client: fakeClient(true) });
    const response = await request(app).post('/api/chat').send({ message: 'Phân tích nhân vật Furiosa', history: Array.from({ length: 9 }, () => ({ role: 'user', content: 'x' })) });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ reply: 'Một câu trả lời về phim.', blocked: false });
  });

  it('returns a safe API error when the model is unavailable', async () => {
    const broken = { chat: { completions: { create: async () => { throw new Error('secret upstream detail'); } } } };
    const response = await request(createApp({ client: broken })).post('/api/chat').send({ message: 'Gợi ý phim' });
    expect(response.status).toBe(502);
    expect(response.body.error).toBe('Không thể kết nối dịch vụ AI. Vui lòng thử lại sau.');
  });
});
