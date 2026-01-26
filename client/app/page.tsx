'use client';

import dynamic from 'next/dynamic';
import { UserButton, SignInButton, useUser } from '@clerk/nextjs';
import { Sparkles, FileText } from 'lucide-react';

// Dynamically import components with no SSR
const FileUploadComponent = dynamic(() => import('./components/file-upload'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-gray-400">Loading...</div>
});

const ChatComponent = dynamic(() => import('./components/chat'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-4 text-gray-400">Loading...</div>
});

export default function Home() {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-violet-600/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-600/10 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header with Authentication */}
      <header className="relative w-full border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-lg blur opacity-75"></div>
              <div className="relative bg-gradient-to-r from-violet-600 to-cyan-600 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                PDF Intelligence
              </h1>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                AI-Powered Document Analysis
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLoaded && (
              <>
                {isSignedIn ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-400 font-medium">Connected</span>
                    </div>
                    <UserButton 
                      afterSignOutUrl="/" 
                      appearance={{
                        elements: {
                          avatarBox: "w-10 h-10 ring-2 ring-violet-500/50 hover:ring-violet-400 transition-all"
                        }
                      }}
                    />
                  </div>
                ) : (
                  <SignInButton mode="modal">
                    <button className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-medium rounded-lg hover:from-violet-500 hover:to-cyan-500 transition-all duration-300 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105">
                      Sign In
                    </button>
                  </SignInButton>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative flex-1 flex">
        {/* Left Sidebar - File Upload */}
        <div className="w-[380px] min-h-full p-6 flex flex-col border-r border-slate-800/50 bg-slate-900/30 backdrop-blur-sm">
          <div className="flex-1 flex items-center justify-center">
            <FileUploadComponent />
          </div>
        </div>

        {/* Right Side - Chat */}
        <div className="flex-1 min-h-full bg-slate-950/30 backdrop-blur-sm">
          <ChatComponent />
        </div>
      </div>
    </div>
  );
}
