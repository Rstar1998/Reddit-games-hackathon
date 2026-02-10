import '../index.css';

import { navigateTo } from '@devvit/web/client';
import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-4xl opacity-20 animate-pulse-slow">🚀</div>
        <div className="absolute top-40 right-20 text-3xl opacity-20 animate-pulse-slow" style={{ animationDelay: '0.5s' }}>💎</div>
        <div className="absolute bottom-32 left-20 text-3xl opacity-20 animate-pulse-slow" style={{ animationDelay: '1s' }}>📈</div>
        <div className="absolute bottom-20 right-10 text-4xl opacity-20 animate-pulse-slow" style={{ animationDelay: '1.5s' }}>🌙</div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md mx-auto animate-fade-in py-8 px-6 min-h-full">
        {/* Logo/Icon */}
        <div className="relative mt-4">
          <div className="text-8xl mb-4 animate-bounce" style={{ animationDuration: '2s' }}>🚀</div>
          <div className="absolute -top-2 -right-2 text-3xl">💎</div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-black text-yellow-500 mb-2 tracking-tight">
            WSB:YOLO
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest font-bold">
            Paper Trading Championship
          </p>
        </div>

        {/* Welcome Message */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm w-full">
          <p className="text-white text-center mb-4">
            Hey <span className="text-yellow-500 font-bold">{context.username ?? 'Ape'}</span>! 👋
          </p>
          <p className="text-slate-400 text-sm text-center">
            Ready to prove your trading skills? Start with <span className="text-green-400 font-bold">$10,000</span> and compete for the top spot!
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-xs text-slate-400">Live Market Data</div>
          </div>
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">🏆</div>
            <div className="text-xs text-slate-400">Daily Leaderboard</div>
          </div>
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">🪙</div>
            <div className="text-xs text-slate-400">Crypto 24/7</div>
          </div>
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-3 text-center">
            <div className="text-2xl mb-1">⚡</div>
            <div className="text-xs text-slate-400">Instant Trades</div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-black font-black text-lg py-4 px-8 rounded-xl shadow-lg shadow-yellow-900/50 transition-all transform hover:scale-105 active:scale-95 border-2 border-yellow-400"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        >
          🚀 START TRADING
        </button>

        {/* Quick Info */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p>• Daily reset at market open (9:30 AM ET)</p>
          <p>• 24/7 Crypto • Stocks (9:30-4:00 ET)</p>
          <p>• Compete with other traders!</p>
        </div>

        {/* Footer - moved inside scrollable area */}
        <footer className="flex gap-3 text-xs text-slate-600 mt-8 mb-4">
          <button
            className="cursor-pointer hover:text-slate-400 transition-colors"
            onClick={() => navigateTo('https://developers.reddit.com/docs')}
          >
            Docs
          </button>
          <span className="text-slate-700">|</span>
          <button
            className="cursor-pointer hover:text-slate-400 transition-colors"
            onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
          >
            r/Devvit
          </button>
          <span className="text-slate-700">|</span>
          <button
            className="cursor-pointer hover:text-slate-400 transition-colors"
            onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
          >
            Discord
          </button>
        </footer>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
