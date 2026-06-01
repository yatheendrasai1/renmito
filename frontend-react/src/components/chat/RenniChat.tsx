import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useAppStore }  from '@/store/appStore';
import { useCreateLog } from '@/hooks/useLogs';
import api              from '@/lib/api';
import './RenniChat.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedLog {
  logTypeId:         string;
  logTypeName:       string;
  domain:            string;
  entryType:         'range' | 'point';
  pointTime:         string | null;
  startTime:         string | null;
  endTime:           string | null;
  title:             string;
  priority?:         'High' | 'Medium' | 'Low' | null;
  ticketId?:         string | null;
  satisfactoryScore?: number | null;
  collaborators?:    string[] | null;
  crucialPerson?:    'Yes' | 'No' | 'Shared' | null;
}

interface ChatResponse {
  type: 'logs' | 'answer';
  text?: string;
  logs?: ParsedLog[];
}

interface Msg {
  from:      'user' | 'renni';
  text?:     string;
  logs?:     ParsedLog[];  // mutable for inline edits
  thinking?: boolean;
  confirmed?: boolean;
  isError?:  boolean;
}

interface Props {
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RenniChat({ onClose }: Props) {
  const selectedDate = useAppStore(s => s.selectedDate);
  const showToast    = useAppStore(s => s.showToast);
  const createLog    = useCreateLog(selectedDate);

  const [msgs,       setMsgs]       = useState<Msg[]>([]);
  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);

    setMsgs(m => [...m, { from: 'user', text }, { from: 'renni', thinking: true }]);

    try {
      const res = await api.post<ChatResponse>('/ai/chat', { message: text, date: selectedDate });
      const data = res.data;

      setMsgs(m => {
        const next = m.filter(msg => !msg.thinking);
        if (data.type === 'logs' && data.logs?.length) {
          next.push({ from: 'renni', logs: [...data.logs] });
        } else {
          next.push({ from: 'renni', text: data.text ?? 'No response.' });
        }
        return next;
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Something went wrong. Please try again.';
      setMsgs(m => [...m.filter(msg => !msg.thinking), { from: 'renni', text: msg, isError: true }]);
    } finally {
      setSending(false);
    }
  }

  /** Confirm and save all parsed logs in message at index i. */
  async function confirmLogs(msgIdx: number) {
    const msg = msgs[msgIdx];
    if (!msg.logs?.length) return;
    setConfirming(msgIdx);

    let saved = 0;
    for (const log of msg.logs) {
      try {
        await createLog.mutateAsync({
          startTime:         log.startTime ?? log.pointTime ?? '00:00',
          endTime:           log.endTime   ?? log.pointTime ?? '00:00',
          title:             log.title,
          logTypeId:         log.logTypeId,
          entryType:         log.entryType,
          pointTime:         log.pointTime ?? undefined,
          priority:          log.priority ?? null,
          ticketId:          log.ticketId ?? undefined,
          satisfactoryScore: log.satisfactoryScore ?? null,
          collaborators:     log.collaborators ?? [],
          crucialPerson:     log.crucialPerson ?? null,
          source:            'ai',
        });
        saved++;
      } catch {
        /* continue on partial failure */
      }
    }

    setMsgs(m => m.map((msg, i) => i === msgIdx ? { ...msg, confirmed: true } : msg));
    setConfirming(null);
    showToast(`Logged ${saved} ${saved === 1 ? 'entry' : 'entries'}`);
  }

  /** Remove one parsed log from a pending confirmation card. */
  function removeLog(msgIdx: number, logIdx: number) {
    setMsgs(m => m.map((msg, i) => {
      if (i !== msgIdx || !msg.logs) return msg;
      const newLogs = msg.logs.filter((_, j) => j !== logIdx);
      return newLogs.length ? { ...msg, logs: newLogs } : { ...msg, logs: undefined, text: 'Removed.' };
    }));
  }

  /** Inline-edit a field of a parsed log. */
  function editLog(msgIdx: number, logIdx: number, field: keyof ParsedLog, value: string) {
    setMsgs(m => m.map((msg, i) => {
      if (i !== msgIdx || !msg.logs) return msg;
      const logs = msg.logs.map((log, j) => j === logIdx ? { ...log, [field]: value } : log);
      return { ...msg, logs };
    }));
  }

  return (
    <>
      <div className="rc-backdrop" onClick={onClose} />
      <div className="rc-popup">

        {/* Header */}
        <div className="rc-header">
          <div className="rc-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="rc-star">
              <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
              <path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25L5 3Z"/>
              <path d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z"/>
            </svg>
            Renni
          </div>
          <button className="rc-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6"  x2="6"  y2="18"/>
              <line x1="6"  y1="6"  x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="rc-messages" ref={scrollRef}>
          {msgs.length === 0 && (
            <div className="rc-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5 }}>
                <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z"/>
                <path d="M5 3L5.75 5.25L8 6L5.75 6.75L5 9L4.25 6.75L2 6L4.25 5.25L5 3Z"/>
                <path d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z"/>
              </svg>
              <p>Hi! I&apos;m Renni. Describe what you did and I&apos;ll log it, or ask anything about your day.</p>
            </div>
          )}

          {msgs.map((msg, i) => (
            <div key={i} className={`rc-msg rc-msg--${msg.from}`}>
              {/* User bubble */}
              {msg.from === 'user' && (
                <div className="rc-bubble rc-bubble--user">{msg.text}</div>
              )}

              {/* Renni: thinking */}
              {msg.from === 'renni' && msg.thinking && (
                <div className="rc-bubble rc-bubble--renni rc-thinking">
                  <span className="rc-dot"/><span className="rc-dot"/><span className="rc-dot"/>
                </div>
              )}

              {/* Renni: text answer */}
              {msg.from === 'renni' && !msg.thinking && msg.text && !msg.logs && (
                <div className={`rc-bubble rc-bubble--renni${msg.isError ? ' rc-bubble--error' : ''}`}>
                  {msg.isError && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  )}
                  {msg.text}
                </div>
              )}

              {/* Renni: confirmed */}
              {msg.from === 'renni' && msg.confirmed && (
                <div className="rc-bubble rc-bubble--renni rc-confirmed">
                  ✓ Logged {msg.logs?.length ?? 0} {(msg.logs?.length ?? 0) === 1 ? 'entry' : 'entries'}
                </div>
              )}

              {/* Renni: parsed logs preview */}
              {msg.from === 'renni' && msg.logs && !msg.confirmed && (
                <div className="rc-log-card">
                  <div className="rc-log-intro">
                    Found {msg.logs.length} log{msg.logs.length > 1 ? 's' : ''}. Review &amp; confirm:
                  </div>
                  {msg.logs.map((log, j) => (
                    <div key={j} className="rc-preview">
                      <div className="rc-card-top">
                        <span className="rc-card-badge">{log.logTypeName} · {log.domain}</span>
                        <button className="rc-remove-btn" onClick={() => removeLog(i, j)} title="Remove">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6"  x2="6"  y2="18"/>
                            <line x1="6"  y1="6"  x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                      <div className="rc-edit-row">
                        <span className="rc-edit-label">Title</span>
                        <input className="rc-edit-input"
                               value={log.title}
                               onChange={e => editLog(i, j, 'title', e.target.value)}
                               placeholder="Title"/>
                      </div>
                      {log.entryType === 'point' ? (
                        <div className="rc-edit-row">
                          <span className="rc-edit-label">Time</span>
                          <input className="rc-edit-input rc-time-input"
                                 value={log.pointTime ?? ''}
                                 onChange={e => editLog(i, j, 'pointTime', e.target.value)}
                                 placeholder="HH:MM"/>
                        </div>
                      ) : (
                        <div className="rc-edit-row">
                          <span className="rc-edit-label">Time</span>
                          <input className="rc-edit-input rc-time-input"
                                 value={log.startTime ?? ''}
                                 onChange={e => editLog(i, j, 'startTime', e.target.value)}
                                 placeholder="HH:MM"/>
                          <span className="rc-time-sep">–</span>
                          <input className="rc-edit-input rc-time-input"
                                 value={log.endTime ?? ''}
                                 onChange={e => editLog(i, j, 'endTime', e.target.value)}
                                 placeholder="HH:MM"/>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    className="rc-confirm-btn"
                    onClick={() => confirmLogs(i)}
                    disabled={confirming === i}
                  >
                    {confirming === i ? 'Saving…' : `✓ Confirm & Log ${msg.logs.length} ${msg.logs.length === 1 ? 'Entry' : 'Entries'}`}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <form className="rc-input-row" onSubmit={send}>
          <textarea
            ref={inputRef}
            className="rc-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Describe what you did…"
            rows={1}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
            }}
          />
          <button type="submit" className="rc-send-btn" disabled={!input.trim() || sending}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
