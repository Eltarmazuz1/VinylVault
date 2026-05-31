import { useState, useRef, useEffect } from 'react';
import { agentAPI } from '../api/client';
import { useAuth } from '../context/AuthContext';
import './AiChat.css';

export default function AiChat({ onRequestAuth }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm your VinylVault music advisor. Tell me what you're in the mood for, or ask me to recommend records based on your taste!" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const threadId = useRef(user?.userId || 'anon');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!user) {
      onRequestAuth();
      return;
    }

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const { data } = await agentAPI.chat(userMsg, threadId.current);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Sorry, I ran into an issue. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} title="AI Music Advisor">
        {open ? '✕' : '🎵'}
      </button>

      {open && (
        <div className="chat-panel">
          <div className="chat-panel__header">
            <span>AI Music Advisor</span>
            <span className="chat-panel__badge">Powered by Gemini</span>
          </div>

          <div className="chat-panel__messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg chat-msg--${m.role}`}>
                <p>{m.text}</p>
              </div>
            ))}
            {loading && (
              <div className="chat-msg chat-msg--assistant">
                <span className="chat-typing">
                  <span className="chat-typing__dot" />
                  <span className="chat-typing__dot" />
                  <span className="chat-typing__dot" />
                </span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form className="chat-panel__input" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={user ? 'Ask for a recommendation…' : 'Sign in to chat with the AI'}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}
