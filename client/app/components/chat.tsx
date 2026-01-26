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
interface IMessage {
  role: 'assistant' | 'user';
  content?: string;
  documents?: Doc[];
}

const ChatComponent: React.FC = () => {
  const [message, setMessage] = React.useState<string>('');
  const [messages, setMessages] = React.useState<IMessage[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

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
      const res = await fetch(`http://localhost:8000/api/chat?message=${encodeURIComponent(userMessage)}`);
      
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
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-50"></div>
            <div className="relative bg-gradient-to-r from-violet-600 to-cyan-600 p-2 rounded-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-200">AI Assistant</h2>
            <p className="text-xs text-slate-400">Ask questions about your documents</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 rounded-full blur-2xl"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700/50">
                <Sparkles className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-200 mb-2">Start a conversation</h3>
              <p className="text-slate-400 max-w-md">
                Upload a PDF document and ask questions to get AI-powered insights
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
                      ? 'bg-gradient-to-br from-violet-600 to-violet-700'
                      : 'bg-gradient-to-br from-cyan-600 to-cyan-700'
                  } shadow-lg`}>
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
                      ? 'bg-gradient-to-br from-violet-600/20 to-violet-700/20 border border-violet-500/30 ml-auto max-w-[85%]'
                      : 'bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 mr-auto max-w-[85%]'
                  } shadow-xl`}>
                    <div className={`flex items-center gap-2 mb-2 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      <span className={`text-xs font-semibold ${
                        message.role === 'user' ? 'text-violet-300' : 'text-cyan-300'
                      }`}>
                        {message.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                    </div>
                    <div className={`whitespace-pre-wrap text-sm leading-relaxed ${
                      message.role === 'user' ? 'text-slate-100' : 'text-slate-200'
                    }`}>
                      {message.content || (
                        <span className="flex items-center gap-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Thinking...
                        </span>
                      )}
                    </div>
                    {message.documents && message.documents.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <div className="flex items-center gap-2 text-xs text-cyan-400">
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

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-slate-800/50 bg-slate-900/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 rounded-xl blur opacity-50"></div>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder="Ask a question about your documents..."
                className="relative bg-slate-800/50 backdrop-blur-sm border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-violet-500/50 focus:ring-violet-500/20 rounded-xl px-4 py-3 pr-12"
              />
            </div>
            <Button 
              onClick={handleSendChatMessage} 
              disabled={!message.trim()}
              className="bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white border-0 rounded-xl px-6 py-3 h-auto shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105"
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
