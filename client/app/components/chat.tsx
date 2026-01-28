'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import * as React from 'react';
import { Send, Bot, User, FileText, Loader2, Sparkles } from 'lucide-react';

interface Doc {
  pageContent?: string;
  metadata?: {
    loc?: {
      pageNumber?: number;
    };
    source?: string;
  };
}
export interface IMessage {
  role: 'assistant' | 'user';
  content?: string;
  documents?: Doc[];
}

export type ChatBotType = 'dentist' | 'physiotherapist' | 'nutrition';

export type MessagesUpdate = IMessage[] | ((prev: IMessage[]) => IMessage[]);

interface ChatComponentProps {
  bot?: ChatBotType;
  messages?: IMessage[];
  onMessagesChange?: (update: MessagesUpdate) => void;
}

const BOT_LABELS: Record<ChatBotType, { title: string; subtitle: string; emptyHint: string; placeholder: string }> = {
  dentist: { title: 'Dentist', subtitle: 'Oral health & dental care — use your PDFs for context', emptyHint: 'Upload PDFs and ask about teeth, gums, oral health, or dental care', placeholder: 'Ask about oral health, dental care, or your documents...' },
  physiotherapist: { title: 'Physiotherapist', subtitle: 'Movement & rehabilitation — use your PDFs for context', emptyHint: 'Upload PDFs and ask about movement, exercises, pain, or rehabilitation', placeholder: 'Ask about movement, exercises, or your documents...' },
  nutrition: { title: 'Nutrition Doctor', subtitle: 'Diet & nutrition — use your PDFs for context', emptyHint: 'Upload PDFs and ask about diet, nutrients, meals, or nutrition', placeholder: 'Ask about diet, nutrition, or your documents...' },
};

const EMPTY_MESSAGES: IMessage[] = [];

const ChatComponent: React.FC<ChatComponentProps> = ({ bot = 'dentist', messages: controlledMessages, onMessagesChange }) => {
  const [message, setMessage] = React.useState<string>('');
  const [internalMessages, setInternalMessages] = React.useState<IMessage[]>([]);
  const isControlled = onMessagesChange != null;
  const messages = React.useMemo(
    () => (isControlled ? (controlledMessages ?? EMPTY_MESSAGES) : internalMessages),
    [isControlled, controlledMessages, internalMessages]
  );
  const setMessages = React.useCallback(
    (update: MessagesUpdate) => {
      if (onMessagesChange) {
        onMessagesChange(update);
      } else {
        setInternalMessages((prev) => (typeof update === 'function' ? update(prev) : update));
      }
    },
    [onMessagesChange]
  );
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const labels = BOT_LABELS[bot];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendChatMessage = async () => {
    if (!message.trim()) return;
    
    const userMessage = message;
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setMessage('');
    
    // Add empty assistant message for streaming
    const assistantMessageIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
    
    try {
      const res = await fetch(`http://localhost:8000/api/chat?message=${encodeURIComponent(userMessage)}&bot=${encodeURIComponent(bot)}`);
      
      // Check if response is streaming
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('text/event-stream')) {
        throw new Error('Server returned non-streaming response. Backend might be down.');
      }
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';
      let docs: Doc[] = [];
      
      if (!reader) {
        throw new Error('No reader available');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              if (data.type === 'metadata') {
                // Store documents metadata
                docs = data.docs || [];
              } else if (data.type === 'content') {
                // Append content chunk
                streamedContent += data.content;
                
                // Update the assistant message in real-time
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    role: 'assistant',
                    content: streamedContent,
                    documents: docs,
                  };
                  return newMessages;
                });
              } else if (data.type === 'done') {
                // Streaming complete
                console.log('Streaming completed');
              } else if (data.type === 'error') {
                // Handle error from stream
                let errorMessage = '';
                
                switch (data.status) {
                  case 400:
                    errorMessage = `⚠️ Invalid Request\n${data?.message || data?.error || 'Bad request'}`;
                    if (data?.example) {
                      errorMessage += `\n\nExample: ${data.example}`;
                    }
                    break;
                    
                  case 401:
                    errorMessage = `🔑 Authentication Error\n${data?.message || 'Invalid API key'}`;
                    if (data?.troubleshooting) {
                      errorMessage += `\n\nTroubleshooting:\n${data.troubleshooting.join('\n')}`;
                    }
                    break;
                    
                  case 403:
                    errorMessage = `💳 Quota Exceeded\n${data?.message || 'Insufficient credits'}`;
                    if (data?.hint) {
                      errorMessage += `\n\n💡 ${data.hint}`;
                    }
                    break;
                    
                  case 404:
                    errorMessage = `❌ Not Found\n${data?.message || 'Resource not found'}`;
                    break;
                    
                  case 429:
                    errorMessage = `⏰ Rate Limited\n${data?.message || 'Too many requests'}`;
                    if (data?.retryAfter) {
                      errorMessage += `\n\nPlease wait ${data.retryAfter} seconds before trying again.`;
                    }
                    break;
                    
                  case 500:
                  case 503:
                    errorMessage = `🔧 Server Error\n${data?.message || 'Internal server error'}`;
                    if (data?.possibleCauses && data.possibleCauses.length > 0) {
                      errorMessage += `\n\nPossible causes:\n${data.possibleCauses.map((cause: string) => `• ${cause}`).join('\n')}`;
                    }
                    if (data?.hint) {
                      errorMessage += `\n\n💡 ${data.hint}`;
                    }
                    break;
                    
                  default:
                    errorMessage = `Error (${data.status}): ${data?.error || data?.message || 'Unknown error'}`;
                }
                
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    role: 'assistant',
                    content: errorMessage,
                  };
                  return newMessages;
                });
                return;
              }
            } catch (parseError) {
              console.error('Error parsing stream data:', parseError);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      let errorMessage = '❌ Connection Error\n';
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        errorMessage += 'Cannot connect to backend server.\n\n';
        errorMessage += 'Troubleshooting:\n';
        errorMessage += '• Check if backend is running (http://localhost:8000)\n';
        errorMessage += '• Run: cd server && pnpm run dev\n';
        errorMessage += '• Verify health: http://localhost:8000/health';
      } else if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'An unexpected error occurred. Please try again.';
      }
      
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: errorMessage,
        };
        return newMessages;
      });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Chat Header - fixed */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{labels.title}</h2>
            <p className="text-xs text-slate-500">{labels.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Messages Container - only this part scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 bg-slate-50/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="relative bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
              <Sparkles className="w-12 h-12 text-teal-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-800 mb-2">Start a conversation</h3>
              <p className="text-slate-500 max-w-md">
                {labels.emptyHint}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-4 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div className={`flex-shrink-0 ${
                  message.role === 'user' ? 'order-2' : 'order-1'
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-600'
                      : 'bg-teal-600'
                  } shadow-sm`}>
                    {message.role === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>
                </div>

                {/* Message Content */}
                <div className={`flex-1 ${message.role === 'user' ? 'order-1' : 'order-2'}`}>
                  <div className={`rounded-2xl p-5 ${
                    message.role === 'user'
                      ? 'bg-blue-50 border border-blue-100 ml-auto max-w-[85%]'
                      : 'bg-white border border-slate-200 shadow-sm mr-auto max-w-[85%]'
                  }`}>
                    <div className={`flex items-center gap-2 mb-2 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      <span className={`text-xs font-semibold ${
                        message.role === 'user' ? 'text-blue-700' : 'text-teal-700'
                      }`}>
                        {message.role === 'user' ? 'You' : labels.title}
                      </span>
                    </div>
                    <div className={`whitespace-pre-wrap text-sm leading-relaxed ${
                      message.role === 'user' ? 'text-slate-800' : 'text-slate-700'
                    }`}>
                      {message.content || (
                        <span className="flex items-center gap-2 text-slate-500">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Thinking...
                        </span>
                      )}
                    </div>
                    {message.documents && message.documents.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-2 text-xs text-teal-600">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Found {message.documents.length} relevant document{message.documents.length > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area - fixed */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder={labels.placeholder}
                className="bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:ring-blue-400/20 rounded-xl px-4 py-3 pr-12"
              />
            </div>
            <Button 
              onClick={handleSendChatMessage} 
              disabled={!message.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-xl px-6 py-3 h-auto shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};
export default ChatComponent;
