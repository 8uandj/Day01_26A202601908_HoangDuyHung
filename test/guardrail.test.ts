import { describe, expect, it } from 'vitest';
import { classifierPrompt, cleanHistory, OUT_OF_SCOPE_MESSAGE, parseScope } from '../server/guardrail.js';

describe('movie scope guardrail', () => {
  it('frames comparison and character analysis as in scope', () => {
    const prompt = classifierPrompt('So sánh Parasite với Snowpiercer và phân tích Ki-woo.', []);
    expect(prompt).toContain('so sánh tác phẩm');
    expect(prompt).toContain('phân tích nhân vật');
  });

  it('parses only an explicit in-scope decision', () => {
    expect(parseScope('{"inScope":true}')).toBe(true);
    expect(parseScope('{"inScope":false}')).toBe(false);
    expect(parseScope('không phải json')).toBe(false);
  });

  it('keeps only six valid history messages', () => {
    const history = Array.from({ length: 8 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `m${index}` }));
    expect(cleanHistory(history)).toEqual(history.slice(-6));
  });

  it('uses the exact business rejection message', () => {
    expect(OUT_OF_SCOPE_MESSAGE).toBe('không nằm trong phạm vi chatbot yêu phim');
  });
});
