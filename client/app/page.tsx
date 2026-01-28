'use client';

import dynamic from 'next/dynamic';
import { UserButton, SignInButton, useUser, RedirectToSignIn } from '@clerk/nextjs';
import { Sparkles, FileText, Stethoscope, Activity, UtensilsCrossed } from 'lucide-react';
import * as React from 'react';
import type { IMessage, MessagesUpdate } from './components/chat';

// Dynamically import components with no SSR
const FileUploadComponent = dynamic(() => import('./components/file-upload'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-slate-500">Loading...</div>
});

const ChatComponent = dynamic(() => import('./components/chat'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-slate-500">Loading...</div>
});

export type BotType = 'dentist' | 'physiotherapist' | 'nutrition';

const BOT_OPTIONS: { id: BotType; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'dentist', label: 'Dentist', description: 'Oral health & dental care', icon: <Stethoscope className="w-5 h-5" /> },
  { id: 'physiotherapist', label: 'Physiotherapist', description: 'Movement & rehabilitation', icon: <Activity className="w-5 h-5" /> },
  { id: 'nutrition', label: 'Nutrition Doctor', description: 'Diet & nutrition', icon: <UtensilsCrossed className="w-5 h-5" /> },
];

const initialMessagesByBot: Record<BotType, IMessage[]> = {
  dentist: [],
  physiotherapist: [],
  nutrition: [],
};

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();
  const [selectedBot, setSelectedBot] = React.useState<BotType>('dentist');
  const [messagesByBot, setMessagesByBot] = React.useState<Record<BotType, IMessage[]>>(initialMessagesByBot);

  const handleMessagesChange = React.useCallback((bot: BotType) => (update: MessagesUpdate) => {
    setMessagesByBot((prev) => ({
      ...prev,
      [bot]: typeof update === 'function' ? update(prev[bot] ?? []) : update,
    }));
  }, []);

  // Require sign-in before showing chatbot UI
  if (isLoaded && !isSignedIn) {
    return <RedirectToSignIn />;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Subtle medical background accent */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50/80 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-teal-50/50 rounded-full blur-3xl"></div>
      </div>

      {/* Header with Authentication */}
      <header className="relative w-full border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-blue-600">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">
                Care Chat
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600" />
                Dentist · Physiotherapist · Nutrition
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-emerald-700 font-medium">Connected</span>
                    </div>
                    <UserButton 
                      afterSignOutUrl="/" 
                      appearance={{
                        elements: {
                          avatarBox: "w-10 h-10 ring-2 ring-blue-200 hover:ring-blue-300 transition-all"
                        }
                      }}
                    />
                  </div>
                ) : (
                  <SignInButton mode="modal">
                    <button className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm hover:shadow-md">
                      Sign In
                    </button>
                  </SignInButton>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Bot selector - 3 options on top */}
      <div className="relative w-full border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {BOT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedBot(opt.id)}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl font-medium transition-all duration-200 ${
                selectedBot === opt.id
                  ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300 ring-offset-2'
                  : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200/80 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              <span className={selectedBot === opt.id ? 'text-white' : 'text-slate-500'}>{opt.icon}</span>
              <div className="text-left">
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="block text-xs opacity-85">{opt.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content - fixed height so only chat area scrolls */}
      <div className="relative flex-1 flex min-h-0">
        {/* Left Sidebar - File Upload */}
        <div className="w-[380px] flex-shrink-0 p-6 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
          <div className="flex-1 flex items-center justify-center min-h-0">
            <FileUploadComponent />
          </div>
        </div>

        {/* Right Side - Chat (only this area scrolls inside) */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50/80">
          <ChatComponent
            bot={selectedBot}
            messages={messagesByBot[selectedBot] ?? []}
            onMessagesChange={handleMessagesChange(selectedBot)}
          />
        </div>
      </div>
    </div>
  );
}
