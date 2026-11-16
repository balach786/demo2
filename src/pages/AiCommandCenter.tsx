import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Send, Paperclip, ShieldCheck, Check, X, PencilLine, Info, Languages,
  Trash2, ArrowRight, FileText, Clock, CircleDollarSign, Mic, Volume2,
} from 'lucide-react';
import { Page, Card, CardHead, StatusBadge, InfoCallout } from '../components/ui';
import { useStore } from '../demo/store';
import { runAiCommand, SUGGESTED_PROMPTS, type AiResult } from '../ai/engine';
import { formatPKR, formatDateTime } from '../lib/format';
import { partyBalance } from '../demo/accounting';
import {
  VoiceListeningBar,
  VoiceResponseButton,
  VoiceHeaderControls,
} from '../components/VoiceControls';
import {
  VoiceRecognitionController,
  isSpeechRecognitionSupported,
} from '../voice/speechRecognition';
import { voiceSynthesizer } from '../voice/speechSynthesis';
import type { SpeechLanguage, VoiceRecognitionError, VoiceRecognitionState } from '../voice/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  result?: AiResult;
  approvalId?: string;
}

const INITIAL: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'ai',
    text:
      'Assalam-o-Alaikum! I am your AI Business Secretary for **ABC Trading Company**.\n' +
      'Ask me about sales, profit, cash position, any party ledger, or tell me to prepare a payment — I will draft it and wait for your approval.\n' +
      'You can write or speak in English, Roman Urdu, or Urdu.',
  },
];

function renderRich(text: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const parts: (string | JSX.Element)[] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    while ((match = regex.exec(line)) !== null) {
      if (match.index > last) parts.push(line.slice(last, match.index));
      parts.push(<strong key={key++}>{match[1]}</strong>);
      last = match.index + match[0].length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return (
      <p key={li} style={{ marginTop: li === 0 ? 0 : 6 }}>
        {parts.length ? parts : '\u00A0'}
      </p>
    );
  });
}

export default function AiCommandCenter() {
  const { data, createApproval, approve, reject, pushToast, addActivity } = useStore();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [history, setHistory] = useState<{ q: string; at: string; intent: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recognition & speech synthesis state
  const [recState, setRecState] = useState<VoiceRecognitionState>('idle');
  const [speechLang, setSpeechLang] = useState<SpeechLanguage>('ur-PK');
  const [interimText, setInterimText] = useState('');
  const [volume, setVolume] = useState(0.3);
  const [recError, setRecError] = useState<VoiceRecognitionError | null>(null);
  const [autoPlayVoice, setAutoPlayVoice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('ai_secretary_voice_auto_play') === 'true';
    } catch {
      return false;
    }
  });

  const recControllerRef = useRef<VoiceRecognitionController | null>(null);

  const pending = useMemo(() => data.approvals.filter((a) => a.status === 'pending' || a.status === 'draft'), [data.approvals]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, data.approvals.length]);

  // Initialize Speech Recognition Controller
  useEffect(() => {
    const controller = new VoiceRecognitionController(
      {
        onStateChange: (st) => setRecState(st),
        onInterimText: (txt) => setInterimText(txt),
        onFinalText: (txt) => {
          setInput((prev) => (prev ? `${prev} ${txt}`.trim() : txt.trim()));
          setInterimText('');
        },
        onError: (err) => setRecError(err),
        onVolumeChange: (vol) => setVolume(vol),
      },
      speechLang
    );

    recControllerRef.current = controller;

    return () => {
      controller.cancel();
      voiceSynthesizer.stop();
    };
  }, [speechLang]);

  const handleAutoPlayToggle = (val: boolean) => {
    setAutoPlayVoice(val);
    try {
      localStorage.setItem('ai_secretary_voice_auto_play', val ? 'true' : 'false');
    } catch {}
  };

  const toggleListening = async () => {
    setRecError(null);
    if (recState === 'listening' || recState === 'requesting') {
      const text = recControllerRef.current?.stop() || '';
      if (text) {
        setInput((prev) => (prev ? `${prev} ${text}`.trim() : text.trim()));
      }
      setInterimText('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else {
      if (!isSpeechRecognitionSupported()) {
        setRecError({
          type: 'not-supported',
          message: 'Web Speech API is not available in this browser.',
          remedy: 'Use Google Chrome, Microsoft Edge, or pick a suggested prompt below to test voice workflow.',
        });
        return;
      }
      const started = await recControllerRef.current?.start(speechLang);
      if (!started) {
        // error handled via onError callback
      }
    }
  };

  const handleVoiceDone = () => {
    const text = recControllerRef.current?.stop() || '';
    if (text) {
      setInput((prev) => (prev ? `${prev} ${text}`.trim() : text.trim()));
    }
    setInterimText('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleVoiceCancel = () => {
    recControllerRef.current?.cancel();
    setInterimText('');
    setRecError(null);
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    window.setTimeout(() => {
      const result = runAiCommand(text, data);
      let approvalId: string | undefined;
      if (result.draft) {
        const approval = createApproval({
          title: result.draft.title,
          subtitle: result.draft.subtitle,
          origin: 'ai',
          draft: result.draft.draft,
          command: text,
          confidence: result.draft.confidence,
          uncertainties: result.draft.uncertainties,
        });
        approvalId = approval.id;
        addActivity({
          at: new Date().toISOString(),
          actor: 'ai',
          tone: 'warning',
          title: 'AI prepared a transaction draft',
          detail: `${formatPKR(result.draft.draft.amount)} · awaiting approval`,
        });
        pushToast({
          title: 'Draft created — approval required',
          text: `${result.draft.title}. Reference ${approval.reference}.`,
          tone: 'info',
        });
      }

      const aiMsgId = `a-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: 'ai', text: result.text, result, approvalId },
      ]);
      setHistory((prev) => [{ q: text, at: new Date().toISOString(), intent: result.intentLabel }, ...prev].slice(0, 8));
      setTyping(false);

      // Auto-read response aloud if voice response is enabled
      if (autoPlayVoice) {
        voiceSynthesizer.speak(aiMsgId, result.text, {
          preferredLanguage: result.language === 'roman-urdu' ? 'ur' : 'en',
        });
      }
    }, 520);
  };

  return (
    <Page
      title="Command Center"
      subtitle="Natural-language business commands in English and Roman Urdu, answered from the same demo ledger used by the accounting module."
      actions={
        <>
          <span className="badge amber"><span className="dot" /> Simulated assistant</span>
          <button className="btn" onClick={() => { setMessages(INITIAL); setHistory([]); }}>
            <Trash2 size={14} /> Clear chat
          </button>
        </>
      }
    >
      <div className="ai-page">
        <Card className="chat-card">
          <div className="chat-head">
            <div className="ai-orb"><Sparkles size={18} /></div>
            <div>
              <div className="card-title">AI Business Secretary</div>
              <div className="card-sub">Connected to demo ledger · {data.entries.length} journal entries in memory</div>
            </div>
            <div className="spacer" />
            <span className="badge green"><span className="dot" /> Ready</span>
          </div>

          <VoiceHeaderControls
            autoPlay={autoPlayVoice}
            onAutoPlayToggle={handleAutoPlayToggle}
            language={speechLang}
            onLanguageChange={(lang) => {
              setSpeechLang(lang);
              recControllerRef.current?.setLanguage(lang);
            }}
          />

          <div className="chat-scroll" ref={scrollRef}>
            {messages.map((msg) => (
              <div className={`msg ${msg.role}`} key={msg.id}>
                <div className="msg-avatar">{msg.role === 'ai' ? <Sparkles size={14} /> : 'DU'}</div>
                <div className="bubble">
                  {renderRich(msg.text)}

                  {msg.result?.metrics ? (
                    <div className="ai-metrics">
                      {msg.result.metrics.map((mm) => (
                        <div className="ai-metric" key={mm.label}>
                          <div className="m-label">{mm.label}</div>
                          <div className="m-value">{mm.value}</div>
                          {mm.hint ? <div className="m-hint">{mm.hint}</div> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {msg.result?.table ? (
                    <div className="ai-table">
                      {msg.result.table.title ? (
                        <div className="row" style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                          <span className="xsmall bold">{msg.result.table.title}</span>
                        </div>
                      ) : null}
                      <table>
                        <thead>
                          <tr>
                            {msg.result.table.columns.map((c) => (
                              <th key={c.label} className={c.numeric ? 'num' : ''}>{c.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.result.table.rows.map((row, ri) => (
                            <tr key={ri}>
                              {row.map((cell, ci) => (
                                <td key={ci} className={msg.result?.table?.columns[ci]?.numeric ? 'num' : ''}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {msg.approvalId ? <DraftPreview approvalId={msg.approvalId} /> : null}

                  {msg.result?.links?.length ? (
                    <div className="ai-actions">
                      {msg.result.links.map((l) => (
                        <button key={l.to + l.label} className="btn xs" onClick={() => navigate(l.to)}>
                          {l.label} <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {msg.role === 'ai' ? (
                    <div className="row wrap" style={{ gap: 8, marginTop: 9, alignItems: 'center' }}>
                      {msg.id !== 'welcome' && (
                        <span className="ai-sim-note"><Info size={11} /> Simulated response · rule-based engine · no AI API call</span>
                      )}
                      {msg.result ? <span className="tag">intent: {msg.result.intent}</span> : null}
                      <VoiceResponseButton messageId={msg.id} text={msg.text} language={msg.result?.language} />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {typing ? (
              <div className="msg ai">
                <div className="msg-avatar"><Sparkles size={14} /></div>
                <div className="bubble">
                  <div className="typing"><span /><span /><span /></div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="chat-input-area">
            <VoiceListeningBar
              state={recState}
              interimText={interimText}
              language={speechLang}
              volume={volume}
              onDone={handleVoiceDone}
              onCancel={handleVoiceCancel}
              onLanguageChange={(lang) => {
                setSpeechLang(lang);
                recControllerRef.current?.setLanguage(lang);
              }}
              error={recError}
            />

            <div className="chips mb-2">
              {SUGGESTED_PROMPTS.slice(0, 4).map((p) => (
                <button key={p.text} className="chip" onClick={() => send(p.text)} title={p.sub}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="chat-input-row">
              <button
                type="button"
                className={`mic-btn ${recState === 'listening' ? 'listening' : ''}`}
                onClick={toggleListening}
                title={
                  recState === 'listening'
                    ? 'Listening… Click to stop and review text'
                    : 'Click microphone to speak your command'
                }
                aria-label="Microphone voice command"
              >
                <Mic size={18} />
              </button>
              <textarea
                ref={textareaRef}
                className="chat-input"
                rows={1}
                placeholder='Type or speak a command… e.g. "Aaj ki total sales kitni hain?"'
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <button className="btn" onClick={() => navigate('/documents')} title="Upload a document for extraction" aria-label="Upload document">
                <Paperclip size={15} />
              </button>
              <button className="btn primary" onClick={() => send(input)} disabled={!input.trim() || typing}>
                <Send size={15} /> Send
              </button>
            </div>
            <div className="chat-meta">
              <span className="row" style={{ gap: 4 }}><Languages size={12} /> Urdu + Roman Urdu + English</span>
              <span>·</span>
              <span className="row" style={{ gap: 4 }}><Mic size={12} /> Speak & review before send</span>
              <span>·</span>
              <span>Financial actions always create an approval draft</span>
            </div>
          </div>
        </Card>

        <aside className="ai-side">
          <Card>
            <CardHead title="Suggested prompts" sub="Click to run a live command" icon={<Sparkles size={15} />} />
            <div className="card-body" style={{ padding: '6px 8px 12px' }}>
              {SUGGESTED_PROMPTS.map((p) => (
                <div className="prompt-item" key={p.text} onClick={() => send(p.text)} role="button" tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && send(p.text)}>
                  <span className="pi-icon"><Sparkles size={13} /></span>
                  <span>
                    {p.label}
                    <div className="pi-sub">{p.sub}</div>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Conversation history" sub={`${history.length} command${history.length === 1 ? '' : 's'} this session`} icon={<Clock size={15} />} />
            <div className="card-body" style={{ padding: '8px 10px 12px' }}>
              {history.length === 0 ? (
                <div className="xsmall muted" style={{ padding: '6px 4px' }}>
                  Your commands will appear here — click one to run it again.
                </div>
              ) : (
                history.map((h, i) => (
                  <div className="prompt-item" key={i} onClick={() => send(h.q)} role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && send(h.q)}>
                    <span className="pi-icon"><FileText size={13} /></span>
                    <span>
                      {h.q}
                      <div className="pi-sub">{h.intent} · {formatDateTime(h.at)}</div>
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Awaiting your approval" sub="Nothing posts without approval" icon={<ShieldCheck size={15} />}
              actions={<button className="xsmall bold" style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--blue-600)' }} onClick={() => navigate('/approvals')}>All</button>} />
            <div className="card-body" style={{ padding: '8px 12px 14px' }}>
              {pending.length === 0 ? (
                <div className="xsmall muted">No pending actions. Ask the AI to prepare a payment to see the workflow.</div>
              ) : (
                pending.slice(0, 3).map((a) => (
                  <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f3f8' }}>
                    <div className="row" style={{ gap: 8 }}>
                      <CircleDollarSign size={14} color="var(--amber)" />
                      <span className="small bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatPKR(a.draft.amount)}
                      </span>
                      <span className="spacer" />
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="xsmall muted" style={{ marginTop: 2 }}>{a.title}</div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <InfoCallout tone="warn" title="Demo honesty">
            Responses are generated by a deterministic rule-based engine over the demo dataset — not by the OpenAI API.
            No API key or external service is used.
          </InfoCallout>
        </aside>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* inline draft / approval preview                                     */
/* ------------------------------------------------------------------ */
function DraftPreview({ approvalId }: { approvalId: string }) {
  const { data, approve, reject, pushToast, addActivity } = useStore();
  const navigate = useNavigate();
  const approval = data.approvals.find((a) => a.id === approvalId);
  if (!approval) return null;

  const party = data.parties.find((p) => p.id === approval.draft.partyId);
  const account = data.accounts.find((a) => a.id === approval.draft.accountId);
  const settled = approval.status === 'completed' || approval.status === 'rejected';
  const balanceAfter = party ? partyBalance(data, party.id).balance : 0;

  return (
    <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <div className="row" style={{ padding: '9px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
        <ShieldCheck size={14} color="var(--amber)" />
        <span className="small bold">Action preview</span>
        <span className="spacer" />
        <StatusBadge status={approval.status} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div className="field-row"><span className="f-label">Reference</span><span className="f-value mono">{approval.reference}</span></div>
        <div className="field-row"><span className="f-label">Transaction type</span><span className="f-value">{approval.draft.type === 'payment' ? 'Payment (Money Paid)' : approval.draft.type === 'receipt' ? 'Receipt (Money Received)' : approval.draft.type}</span></div>
        <div className="field-row"><span className="f-label">Party</span><span className="f-value">{party?.name ?? '—'}</span></div>
        <div className="field-row"><span className="f-label">Amount</span><span className="f-value">{formatPKR(approval.draft.amount)}</span></div>
        <div className="field-row"><span className="f-label">Account</span><span className="f-value">{account?.name ?? approval.draft.accountId}</span></div>
        <div className="field-row"><span className="f-label">Debit / Credit</span><span className="f-value small">Dr {formatPKR(approval.draft.lines.reduce((s, l) => s + l.debit, 0))} · Cr {formatPKR(approval.draft.lines.reduce((s, l) => s + l.credit, 0))}</span></div>
      </div>
      {!settled ? (
        <div className="row" style={{ padding: '10px 12px', gap: 8, borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <button
            className="btn success sm"
            onClick={() => {
              const projected = approval.draft.type === 'payment' ? balanceAfter - approval.draft.amount : balanceAfter + approval.draft.amount;
              const posted = approve(approval.id);
              if (!posted) {
                pushToast({ title: 'Could not post', text: 'This draft is not balanced or was already processed.', tone: 'error' });
                return;
              }
              addActivity({ at: new Date().toISOString(), actor: 'user', tone: 'success', title: 'Approved AI draft', detail: `${formatPKR(approval.draft.amount)} · ${approval.reference} · ${posted.reference}` });
              pushToast({
                title: `Approved · posted as ${posted.reference}`,
                text: `${approval.reference} approved. ${party?.name ?? ''} balance moves to ${formatPKR(Math.abs(projected))}.`,
                tone: 'success',
              });
            }}
          >
            <Check size={14} /> Approve
          </button>
          <button className="btn danger sm" onClick={() => { reject(approval.id, 'Rejected during demo review'); pushToast({ title: 'Draft rejected', text: `${approval.reference} was not posted.`, tone: 'info' }); }}>
            <X size={14} /> Reject
          </button>
          <button className="btn sm" onClick={() => navigate(`/approvals?edit=${approval.id}`)}>
            <PencilLine size={14} /> Edit draft
          </button>
          <span className="spacer" />
          <span className="xsmall muted">Party balance before: {formatPKR(balanceAfter)}</span>
        </div>
      ) : (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <div className="xsmall muted">
            {approval.status === 'completed'
              ? `Posted to the demo ledger. ${party ? `${party.name} balance is now ${formatPKR(balanceAfter)}.` : ''}`
              : `Rejected: ${approval.rejectionReason ?? 'no reason recorded'}`}
          </div>
          <button className="btn xs mt-2" onClick={() => navigate('/transactions')}>View in transactions</button>
        </div>
      )}
    </div>
  );
}
