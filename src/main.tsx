import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUp, Clapperboard, Compass, Film, MessageCircle, MoonStar, Sparkles } from 'lucide-react';
import './styles.css';

type Message = { role: 'user' | 'assistant'; content: string; blocked?: boolean };

const starters = [
  { icon: <Sparkles size={17} />, label: 'Gợi ý phim', prompt: 'Gợi ý 3 phim truyền cảm hứng cho sinh viên VinUni.' },
  { icon: <Compass size={17} />, label: 'So sánh', prompt: 'So sánh Oppenheimer và The Imitation Game về cách kể chuyện.' },
  { icon: <MessageCircle size={17} />, label: 'Nhân vật', prompt: 'Phân tích hành trình trưởng thành của Chihiro trong Spirited Away.' },
  { icon: <MoonStar size={17} />, label: 'Thử phạm vi', prompt: 'Tôi bị đau đầu thì nên uống thuốc gì?' },
];

export default function App() {
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Chào bạn, mình là CineBot. Cùng mở một cuộc trò chuyện thật hay về phim nhé.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, loading]);

  async function ask(raw: string) {
    const content = raw.trim();
    if (!content || loading) return;
    const userMessage: Message = { role: 'user', content };
    const priorHistory = messages.slice(-6).map(({ role, content: previous }) => ({ role, content: previous }));
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history: priorHistory }),
      });
      const data = await response.json() as { reply?: string; blocked?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
      setMessages((current) => [...current, { role: 'assistant', content: data.reply || 'Mình chưa thể trả lời lúc này.', blocked: data.blocked }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'Không thể gửi câu hỏi.', blocked: true }]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void ask(input); }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(input); }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div>
        <a className="brand" href="/" aria-label="VinUni CineBot home"><span>VU</span><strong>VinUni</strong></a>
        <div className="sidebar-copy"><p className="eyebrow">CINEMA SOCIETY</p><h1>Stories<br /><em>worth</em> talking about.</h1><p>Không gian điện ảnh dành cho cộng đồng VinUniversity — từ bộ phim đầu tiên đến cuộc tranh luận sau cùng.</p></div>
      </div>
      <div className="scope-card"><Film size={19} /><div><strong>Phạm vi mở rộng</strong><span>Phim, so sánh, nhân vật & điện ảnh</span></div></div>
    </aside>

    <section className="chat-panel">
      <header className="topbar">
        <div className="bot-identity"><div className="bot-mark"><Clapperboard size={21} /></div><div><strong>VinUni CineBot</strong><span><i /> Online · Film companion</span></div></div>
        <div className="topbar-tag">Movie conversation</div>
      </header>

      <div className="conversation" aria-live="polite">
        <div className="intro"><p className="eyebrow">START A SCREENING</p><h2>Một ý tưởng hay<br />luôn bắt đầu bằng <em>một câu hỏi.</em></h2><p>Hỏi về bộ phim bạn yêu thích, đặt hai tác phẩm cạnh nhau, hoặc cùng giải mã một nhân vật.</p></div>
        <div className="starter-grid">{starters.map((starter) => <button className="starter" key={starter.label} onClick={() => void ask(starter.prompt)} disabled={loading}><span>{starter.icon}</span><strong>{starter.label}</strong><small>{starter.prompt}</small></button>)}</div>
        <div className="message-list">{messages.map((message, index) => <article className={`message ${message.role}${message.blocked ? ' blocked' : ''}`} key={`${message.role}-${index}`}><span>{message.role === 'assistant' ? 'C' : 'Bạn'}</span><p>{message.content}</p></article>)}{loading && <article className="message assistant loading"><span>C</span><p><b /><b /><b /></p></article>}<div ref={endRef} /></div>
      </div>

      <footer className="composer-wrap"><form className="composer" onSubmit={submit}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Khám phá thế giới điện ảnh…" rows={1} aria-label="Câu hỏi về phim" /><button type="submit" disabled={!input.trim() || loading} aria-label="Gửi câu hỏi"><ArrowUp size={19} /></button></form><p>Enter để gửi · Shift + Enter xuống dòng <span>Chỉ trò chuyện về phim và điện ảnh</span></p></footer>
    </section>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
