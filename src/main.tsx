import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUp, Clapperboard, Clock3, Compass, Film, GitCompareArrows, LibraryBig, MessageCircle, MoonStar, RotateCcw, Sparkles, UserRoundSearch, X } from 'lucide-react';
import './styles.css';

type TokenUsage = { input: number; output: number; total: number };
type Message = { role: 'user' | 'assistant'; content: string; blocked?: boolean; streaming?: boolean; usage?: TokenUsage; latencyMs?: number };
type Conversation = { id: string; title: string; updatedAt: number; messages: Message[] };

const HISTORY_KEY = 'vinuni-cinebot-history-v1';
const CONVERSATIONS_KEY = 'vinuni-cinebot-conversations-v1';
const welcomeMessage: Message = { role: 'assistant', content: 'Chào bạn, mình là CineBot. Cùng mở một cuộc trò chuyện thật hay về phim nhé.' };

function createConversationId() {
  return globalThis.crypto?.randomUUID?.() ?? `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Message => Boolean(item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'))
    .slice(-60);
}

function titleFromMessages(messages: Message[]) {
  const firstQuestion = messages.find((message) => message.role === 'user')?.content.trim();
  return firstQuestion ? `${firstQuestion.slice(0, 34)}${firstQuestion.length > 34 ? '…' : ''}` : 'Cuộc trò chuyện mới';
}

function loadConversations(): Conversation[] {
  try {
    const stored = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) ?? '[]');
    if (Array.isArray(stored)) {
      const conversations = stored
        .filter((item): item is Conversation => Boolean(item && typeof item.id === 'string' && Array.isArray(item.messages)))
        .map((item) => ({ id: item.id, title: typeof item.title === 'string' ? item.title : titleFromMessages(cleanMessages(item.messages)), updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(), messages: cleanMessages(item.messages) }))
        .filter((item) => item.messages.length);
      if (conversations.length) return conversations.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
    }

    const legacy = cleanMessages(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'));
    if (legacy.length) return [{ id: createConversationId(), title: titleFromMessages(legacy), updatedAt: Date.now(), messages: legacy }];
  } catch {
    // A corrupt local value should never prevent the app from loading.
  }
  return [];
}

function formatConversationTime(timestamp: number) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

const starters = [
  { icon: <Sparkles size={17} />, label: 'Gợi ý phim', prompt: 'Gợi ý 3 phim truyền cảm hứng cho sinh viên VinUni.' },
  { icon: <Compass size={17} />, label: 'So sánh', prompt: 'So sánh Oppenheimer và The Imitation Game về cách kể chuyện.' },
  { icon: <MessageCircle size={17} />, label: 'Nhân vật', prompt: 'Phân tích hành trình trưởng thành của Chihiro trong Spirited Away.' },
  { icon: <MoonStar size={17} />, label: 'Thử phạm vi', prompt: 'Tôi bị đau đầu thì nên uống thuốc gì?' },
];

const railPrompts = [
  { icon: <Sparkles size={16} />, label: 'Khám phá phim', prompt: 'Gợi ý một bộ phim đáng xem tối nay.' },
  { icon: <GitCompareArrows size={16} />, label: 'Đặt lên bàn cân', prompt: 'So sánh hai phim có cùng chủ đề thật thú vị.' },
  { icon: <UserRoundSearch size={16} />, label: 'Giải mã nhân vật', prompt: 'Phân tích một nhân vật điện ảnh đáng nhớ.' },
];

export default function App() {
  const [bootstrap] = useState(() => {
    const saved = loadConversations();
    return { conversations: saved, activeId: saved[0]?.id ?? createConversationId(), messages: saved[0]?.messages ?? [welcomeMessage] };
  });
  const [conversations, setConversations] = useState<Conversation[]>(bootstrap.conversations);
  const [activeConversationId, setActiveConversationId] = useState(bootstrap.activeId);
  const [messages, setMessages] = useState<Message[]>(bootstrap.messages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const savedMessages = messages.slice(-60);
    const conversation: Conversation = { id: activeConversationId, title: titleFromMessages(savedMessages), updatedAt: Date.now(), messages: savedMessages };
    setConversations((current) => {
      const next = [conversation, ...current.filter((item) => item.id !== activeConversationId)].slice(0, 20);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(next));
      localStorage.setItem(HISTORY_KEY, JSON.stringify(savedMessages));
      return next;
    });
  }, [messages, activeConversationId]);

  useEffect(() => {
    if (!historyOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setHistoryOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [historyOpen]);

  async function ask(raw: string) {
    const content = raw.trim();
    if (!content || loading) return;
    const userMessage: Message = { role: 'user', content };
    const priorHistory = messages.slice(-6).map(({ role, content: previous }) => ({ role, content: previous }));
    setMessages((current) => [...current, userMessage, { role: 'assistant', content: '', streaming: true }]);
    setInput('');
    const requestStartedAt = performance.now();
    setLoading(true);

    const updateLastAssistant = (update: (message: Message) => Message) => {
      setMessages((current) => {
        const index = current.length - 1;
        const last = current[index];
        if (!last || last.role !== 'assistant') return current;
        return [...current.slice(0, index), update(last)];
      });
    };

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history: priorHistory }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'Không gọi được dịch vụ AI.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError = '';

      const handleEvent = (block: string) => {
        const event = block.match(/^event: (.+)$/m)?.[1];
        const rawData = block.match(/^data: (.+)$/m)?.[1];
        if (!event || !rawData) return;
        const data = JSON.parse(rawData) as { text?: string; blocked?: boolean; input?: number; output?: number; total?: number; latencyMs?: number; error?: string };
        const deltaText = data.text;
        if (event === 'delta' && deltaText) updateLastAssistant((message) => ({ ...message, content: message.content + deltaText.replaceAll('*', '') }));
        const inputTokens = data.input;
        const outputTokens = data.output;
        const totalTokens = data.total;
        if (event === 'usage' && inputTokens !== undefined && outputTokens !== undefined && totalTokens !== undefined) updateLastAssistant((message) => ({ ...message, usage: { input: inputTokens, output: outputTokens, total: totalTokens } }));
        if (event === 'done') updateLastAssistant((message) => ({ ...message, blocked: data.blocked, streaming: false, latencyMs: data.latencyMs }));
        if (event === 'error') {
          streamError = data.error || 'Không thể kết nối dịch vụ AI.';
          updateLastAssistant((message) => ({ ...message, latencyMs: data.latencyMs, streaming: false }));
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        events.forEach(handleEvent);
        if (done) break;
      }
      if (buffer.trim()) handleEvent(buffer);
      if (streamError) throw new Error(streamError);
    } catch (error) {
      updateLastAssistant((message) => ({ ...message, content: message.content || (error instanceof Error ? error.message : 'Không thể gửi câu hỏi.'), blocked: true, streaming: false, latencyMs: message.latencyMs ?? Math.round(performance.now() - requestStartedAt) }));
    } finally {
      setLoading(false);
    }
  }

  function startNewConversation() {
    setActiveConversationId(createConversationId());
    setMessages([welcomeMessage]);
    setInput('');
  }

  function openConversation(conversation: Conversation) {
    if (loading) return;
    setActiveConversationId(conversation.id);
    setMessages(conversation.messages);
    setInput('');
    setHistoryOpen(false);
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(input); }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="brand-row"><a className="brand" href="/" aria-label="VinUni CineBot home"><span>VU</span><strong>VinUni</strong></a><div className="sidebar-actions"><button className="history-trigger" type="button" onClick={() => setHistoryOpen(true)}><Clock3 size={14} /> Lịch sử trò chuyện</button><button className="new-chat" type="button" onClick={startNewConversation}><RotateCcw size={14} /> Cuộc trò chuyện mới</button></div></div>
        <div className="sidebar-copy"><p className="eyebrow">CINEMA SOCIETY</p><h1>Stories<br /><em>worth</em> talking about.</h1><p>Không gian điện ảnh cho cộng đồng VinUniversity — từ bộ phim đầu tiên đến cuộc tranh luận sau cùng.</p></div>
        <nav className="sidebar-rail" aria-label="Khám phá CineBot">
          <p>KHÁM PHÁ CÙNG CINEBOT</p>
          {railPrompts.map((item) => <button key={item.label} type="button" onClick={() => void ask(item.prompt)} disabled={loading}><span>{item.icon}</span>{item.label}<ArrowUp size={14} /></button>)}
        </nav>
        <div className="scope-card"><span className="scope-icon"><Film size={18} /></span><div><strong>Movie-only, open-minded</strong><span>So sánh, nhân vật, review và mọi cuộc trò chuyện về điện ảnh.</span></div></div>
        <div className="sidebar-footer"><LibraryBig size={15} /><span>LƯU TỰ ĐỘNG · TRÊN THIẾT BỊ NÀY</span></div>
      </div>
    </aside>

    <section className="chat-panel">
      <header className="topbar">
        <div className="bot-identity"><div className="bot-mark"><Clapperboard size={21} /></div><div><strong>VinUni CineBot</strong><span><i /> Online · Film companion</span></div></div>
        <div className="topbar-tag">Movie conversation</div>
      </header>

      <div className="conversation" aria-live="polite">
        <div className="intro"><p className="eyebrow">START A SCREENING</p><h2>Một ý tưởng hay<br />luôn bắt đầu bằng <em>một câu hỏi.</em></h2><p>Hỏi về bộ phim bạn yêu thích, đặt hai tác phẩm cạnh nhau, hoặc cùng giải mã một nhân vật.</p></div>
        <div className="starter-grid">{starters.map((starter) => <button className="starter" key={starter.label} onClick={() => void ask(starter.prompt)} disabled={loading}><span>{starter.icon}</span><strong>{starter.label}</strong><small>{starter.prompt}</small></button>)}</div>
        <div className="message-list">{messages.map((message, index) => <article className={`message ${message.role}${message.blocked ? ' blocked' : ''}`} key={`${message.role}-${index}`}><span>{message.role === 'assistant' ? 'C' : 'Bạn'}</span><div className="message-body"><p>{message.content}{message.streaming && <i className="stream-cursor" aria-label="Đang trả lời" />}</p>{message.role === 'assistant' && (message.usage || message.latencyMs !== undefined) && <small className="token-usage">{message.usage && <><strong>{message.usage.total} tokens</strong><em>Input {message.usage.input}</em><em>Output {message.usage.output}</em></>}{message.latencyMs !== undefined && <em>Response time {message.latencyMs < 1000 ? `${message.latencyMs}ms` : `${(message.latencyMs / 1000).toFixed(2)}s`}</em>}</small>}</div></article>)}<div ref={endRef} /></div>
      </div>

      <footer className="composer-wrap"><form className="composer" onSubmit={submit}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Khám phá thế giới điện ảnh…" rows={1} aria-label="Câu hỏi về phim" /><button type="submit" disabled={!input.trim() || loading} aria-label="Gửi câu hỏi"><ArrowUp size={19} /></button></form><p>Enter để gửi · Shift + Enter xuống dòng <span>Chỉ trò chuyện về phim và điện ảnh</span></p></footer>
    </section>
    {historyOpen && <div className="history-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryOpen(false); }}>
      <section className="history-dialog" role="dialog" aria-modal="true" aria-labelledby="history-title">
        <header><div><p className="eyebrow">VINUNI CINEBOT</p><h2 id="history-title">Lịch sử trò chuyện</h2></div><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Đóng lịch sử"><X size={19} /></button></header>
        <p className="history-intro">Chọn một cuộc trò chuyện để xem lại và tiếp tục trao đổi.</p>
        <div className="history-dialog-list">{conversations.map((conversation) => <button type="button" key={conversation.id} className={conversation.id === activeConversationId ? 'active' : ''} onClick={() => openConversation(conversation)} disabled={loading}><span><Clock3 size={15} /></span><div><strong>{conversation.title}</strong><small>{formatConversationTime(conversation.updatedAt)} · {conversation.messages.length} tin nhắn</small></div><ArrowUp size={15} /></button>)}</div>
      </section>
    </div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
