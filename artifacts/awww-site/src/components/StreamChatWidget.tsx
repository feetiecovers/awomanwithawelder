import { useState, useEffect, useRef } from 'react';
import { MessageSquare, AlertCircle, RefreshCw, Send } from 'lucide-react';

type ChatMessage = {
  id: string;
  sender: 'visitor' | 'operator';
  text: string;
  createdAt?: string;
};

const widgetStyles = `
  .native-chat-window {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #080d14;
    font-family: sans-serif;
    min-height: 0;
  }

  .native-chat-header {
    background: #0f172a;
    padding: 12px 16px;
    border-bottom: 1px solid #1e293b;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }
  .native-chat-header-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .native-chat-status {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: #10b981;
  }
  .native-chat-title {
    color: #f8fafc;
    font-size: 13px;
    font-weight: 600;
    margin: 0;
  }
  .native-chat-subtitle {
    color: #94a3b8;
    font-size: 10px;
    margin: 2px 0 0 0;
  }

  .native-chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #080d14;
    min-height: 0;
  }

  .native-chat-bubble-container {
    display: flex;
    width: 100%;
  }
  .native-chat-bubble-container.me {
    justify-content: flex-end;
  }
  .native-chat-bubble-container.operator {
    justify-content: flex-start;
  }

  .native-chat-bubble {
    max-width: 75%;
    padding: 10px 14px;
    font-size: 13px;
    line-height: 1.45;
  }
  .native-chat-bubble-container.me .native-chat-bubble {
    background: #1aa1e0;
    color: #ffffff;
    border-radius: 14px 14px 0 14px;
  }
  .native-chat-bubble-container.operator .native-chat-bubble {
    background: #1e293b;
    color: #e2e8f0;
    border: 1px solid #334155;
    border-radius: 14px 14px 14px 0;
  }

  .native-chat-input-area {
    padding: 12px;
    border-top: 1px solid #1e293b;
    background: #0f172a;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-shrink: 0;
  }
  .native-chat-input {
    flex: 1;
    background: #080d14;
    border: 1px solid #1e293b;
    color: #f8fafc;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .native-chat-input:focus {
    border-color: #1aa1e0;
  }
  .native-chat-send {
    background: #1aa1e0;
    color: #ffffff;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .native-chat-send:hover:not(:disabled) {
    background: #1793cc;
  }
  .native-chat-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .native-chat-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: #94a3b8;
    font-size: 11px;
    font-family: monospace;
    padding: 10px 0;
  }
  .native-chat-error {
    background: rgba(239, 68, 68, 0.05);
    border: 1px solid rgba(239, 68, 68, 0.15);
    color: #ef4444;
    font-size: 11px;
    padding: 8px 12px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 12px;
    flex-shrink: 0;
  }
`;

interface StreamChatWidgetProps {
  visitorId: string;
  messages: ChatMessage[];
  error: string | null;
  apiBaseUrl: string;
  onRefetch: () => Promise<void>;
}

export default function StreamChatWidget({
  visitorId,
  messages,
  error,
  apiBaseUrl,
  onRefetch
}: StreamChatWidgetProps) {
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat window
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Submit new customer message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !visitorId) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSubmitting(true);

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatId: visitorId,
          sender: 'visitor',
          text: textToSend,
          visitorName: `Visitor ${visitorId.substring(8, 12)}`,
        }),
      });

      if (res.ok) {
        // Refresh messages immediately for smooth feedback
        await onRefetch();
      } else {
        throw new Error('Failed to post message');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="native-chat-window flex-1 flex flex-col min-h-0">
      <style>{widgetStyles}</style>

      {/* Header */}
      <div className="native-chat-header">
        <div className="native-chat-header-info">
          <div className="native-chat-status" />
          <div>
            <h4 className="native-chat-title">Live Chat Support</h4>
            <p className="native-chat-subtitle">Self-hosted local support operator</p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="native-chat-error">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Message Thread container */}
      <div className="native-chat-messages scroll-industrial flex-1">
        {messages.length === 0 ? (
          <div className="text-center py-20 text-slate-500 text-xs font-mono max-w-[200px] mx-auto leading-relaxed">
            Welcome to Live Chat! Type a message below to reach a support operator.
          </div>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.sender === 'visitor';
            return (
              <div
                key={msg.id}
                className={`native-chat-bubble-container ${isMe ? 'me' : 'operator'}`}
              >
                <div className="native-chat-bubble">
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Text Input Form */}
      <form onSubmit={handleSend} className="native-chat-input-area">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type message here..."
          disabled={submitting || !visitorId}
          className="native-chat-input"
        />
        <button
          type="submit"
          disabled={submitting || !inputText.trim() || !visitorId}
          className="native-chat-send"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
