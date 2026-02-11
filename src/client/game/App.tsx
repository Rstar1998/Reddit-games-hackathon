
import { useState, useEffect } from 'react';
import { api } from '../api';
import { StockData, Portfolio } from '../../shared/types/models';
import { Leaderboard } from './Leaderboard';
import { ADMIN_USERNAMES } from '../../shared/config';

// Price Display Component with Flash Animation
const PriceDisplay = ({ price }: { price: number }) => {
  const [prevPrice, setPrevPrice] = useState(price);
  const [flash, setFlash] = useState<'green' | 'red' | null>(null);

  useEffect(() => {
    if (price > prevPrice) {
      setFlash('green');
      setPrevPrice(price);
    } else if (price < prevPrice) {
      setFlash('red');
      setPrevPrice(price);
    }

    const timer = setTimeout(() => setFlash(null), 1000);
    return () => clearTimeout(timer);
  }, [price]);

  return (
    <div className={`font-mono font-bold text-base md:text-sm transition-all duration-300 px-2 rounded ${flash === 'green' ? 'flash-green' :
      flash === 'red' ? 'flash-red' :
        'text-white'
      }`}>
      ${price.toFixed(2)}
    </div>
  );
};



// Debug Controls Component
const DebugControls = ({ onRefresh }: { onRefresh: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [msg, setMsg] = useState('');

  const handleTimeTravel = async () => {
    setMsg('⏳ Traveling back in time...');
    try {
      const res = await api.debugTimeTravel();
      setMsg(res.success ? '✅ Time Travel Successful! Refreshing...' : '❌ Failed');
      if (res.success) {
        setTimeout(onRefresh, 1000); // Refresh to see reset
      }
    } catch (e) {
      setMsg('❌ Error');
    }
  };

  const handleTriggerScheduler = async () => {
    setMsg('⏳ Triggering scheduler...');
    try {
      const res = await api.debugTriggerScheduler();
      setMsg(res.success ? '✅ Scheduler Triggered!' : '❌ Failed');
    } catch (e) {
      setMsg('❌ Error');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 bg-slate-800 text-slate-500 p-2 rounded-full hover:text-white transition-colors text-xs"
        title="Open Debug Tools"
      >
        🛠️
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-slate-900 border border-slate-700 p-4 rounded-lg shadow-xl z-50 w-64">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-yellow-500 text-sm">🛠️ Debug Tools</h3>
        <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">×</button>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleTimeTravel}
          className="w-full bg-blue-900/50 hover:bg-blue-800 text-blue-200 text-xs py-2 px-3 rounded border border-blue-800 transition-colors"
        >
          ⏪ Simulate "Yesterday"
          <span className="block text-[10px] text-blue-400 mt-1">Forces portfolio reset on next refresh</span>
        </button>

        <button
          onClick={handleTriggerScheduler}
          className="w-full bg-red-900/50 hover:bg-red-800 text-red-200 text-xs py-2 px-3 rounded border border-red-800 transition-colors"
        >
          🚨 Trigger Daily Reset
          <span className="block text-[10px] text-red-400 mt-1">Archives winners & clears leaderboard</span>
        </button>
      </div>

      {msg && <div className="mt-3 text-xs text-center text-white bg-slate-800 p-1 rounded">{msg}</div>}
    </div>
  );
};

export const App = () => {
  const [stocks, setStocks] = useState<StockData[]>([]);
  // ... rest of App component ...

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  const [userId, setUserId] = useState<string>('');
  const [username, setUsername] = useState<string>(''); // Robust username from server
  const [selectedStock, setSelectedStock] = useState<StockData | null>(null);
  const [tradeAmount, setTradeAmount] = useState(1);
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [tradeMessage, setTradeMessage] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);



  const refreshData = async () => {
    try {
      const [stocksRes, portfolioRes] = await Promise.all([
        api.getStocks(),
        api.getPortfolio()
      ]);
      console.log('[FRONTEND] Received stocks:', stocksRes.stocks.length, 'First:', stocksRes.stocks[0]?.symbol, '@', stocksRes.stocks[0]?.price);
      setStocks(stocksRes.stocks);
      setPortfolio(portfolioRes.portfolio);
      if (portfolioRes.totalValue) setTotalValue(portfolioRes.totalValue);
      if (portfolioRes.userId) setUserId(portfolioRes.userId);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initGame = async () => {
      try {
        // Fetch robust username from server init
        const initRes = await api.getInit();
        if (initRes.username) {
          setUsername(initRes.username);
          console.log('[FRONTEND] Init complete. Username:', initRes.username);
        }
        await refreshData();
      } catch (e) {
        console.error('Init failed', e);
        // Fallback to refresh if init fails
        await refreshData();
      }
    };
    initGame();
    const interval = setInterval(refreshData, 2000); // Poll every 2s
    return () => clearInterval(interval);
  }, []);

  const handleTrade = async () => {
    if (!selectedStock) return;
    try {
      setTradeMessage('⏳ Executing trade...');
      const res = await api.trade(selectedStock.symbol, tradeAmount, tradeType);
      if (res.success) {
        setTradeMessage(`✅ ${res.message}`);
        setPortfolio(res.portfolio || null);

        // Refresh all data immediately after successful trade
        await refreshData();

        // Auto-close after success
        setTimeout(() => {
          setSelectedStock(null);
          setTradeMessage('');
        }, 2000);
      } else {
        setTradeMessage(`❌ ${res.message}`);
        // Clear error message after delay
        setTimeout(() => setTradeMessage(''), 3000);
      }
    } catch (err) {
      setTradeMessage('❌ Trade failed');
      setTimeout(() => setTradeMessage(''), 3000);
    }
  };

  // Update selectedStock when stocks array changes
  useEffect(() => {
    if (selectedStock && stocks.length > 0) {
      const updatedStock = stocks.find(s => s.symbol === selectedStock.symbol);
      if (updatedStock) setSelectedStock(updatedStock);
    }
  }, [stocks]);


  if (loading && !portfolio) return <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">🚀 Loading WSB Terminal...</div>;

  // Total Value is now fetched from server to ensure accuracy across all asset types (Stocks + Crypto)

  const dayGain = totalValue - 10000; // Assuming 10k start
  const dayGainPercent = (dayGain / 10000) * 100;

  // Use ET for consistency with server
  const getIsWeekendET = () => {
    const etDateString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const etDate = new Date(etDateString);
    const day = etDate.getDay();
    return day === 0 || day === 6;
  };
  const isWeekend = getIsWeekendET();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans md:font-mono p-2 md:p-6 pb-20">
      {showLeaderboard && <Leaderboard onClose={() => setShowLeaderboard(false)} currentUserId={userId} currentUsername={username} />}

      {/* Header */}
      <header className="mb-6 border-b border-slate-800 pb-4 sticky top-0 bg-slate-950/95 backdrop-blur z-40">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-yellow-500 tracking-tight flex items-center gap-2">
              <span>🚀 WSB:YOLO</span>
            </h1>
            <div className="text-[10px] md:text-xs font-bold tracking-widest mt-1 uppercase opacity-80">
              {isWeekend ?
                <span className="text-blue-400">🌙 Weekend Filter: Crypto Only</span> :
                <span className="text-green-400 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live Market Data
                </span>
              }
            </div>
          </div>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-1.5 px-3 md:py-2 md:px-4 rounded text-xs md:text-sm shadow-lg shadow-yellow-900/20 transition-all border border-yellow-400"
          >
            🏆 LEADERBOARD
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 max-w-7xl mx-auto">

        {/* Left Column: Portfolio & Trade (Mobile: Top) */}
        <div className="md:col-span-5 lg:col-span-4 space-y-4">

          {/* Portfolio Card */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 md:p-6 shadow-xl backdrop-blur-sm animate-slide-in">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Net Worth</h2>
            <div className={`text-3xl md:text-4xl font-black mb-1 number-transition ${dayGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-sm font-bold flex items-center gap-1 ${dayGain >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              <span>{dayGain >= 0 ? '▲' : '▼'}</span>
              <span>${Math.abs(dayGain).toFixed(2)} ({dayGainPercent.toFixed(2)}%)</span>
              <span className="text-slate-500 ml-1 font-normal text-xs">Today</span>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
              <div>
                <div className="text-slate-500 text-xs uppercase">Cash Balance</div>
                <div className="text-white font-mono font-bold">${portfolio?.cash.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-slate-500 text-xs uppercase">Invested Assets</div>
                <div className="text-white font-mono font-bold">${(totalValue - (portfolio?.cash || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Trading Modal Popup */}
          {selectedStock && (
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setSelectedStock(null)}>
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl animate-slide-in" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-bold text-white">{selectedStock.symbol}</h2>
                      <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded border border-slate-700">{isWeekend ? 'CRYPTO' : 'STOCK'}</span>
                    </div>
                    <div className="text-slate-400 text-xs">{selectedStock.name}</div>
                  </div>
                  <button
                    onClick={() => setSelectedStock(null)}
                    className="text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 hover:rotate-90"
                  >
                    ×
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                  {/* Price Display */}
                  <div className="text-center py-4 bg-slate-950/50 rounded-lg border border-slate-800">
                    <div className="text-3xl font-mono font-bold text-white">${selectedStock.price.toFixed(2)}</div>
                    <div className={`text-sm font-bold mt-1 ${selectedStock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%
                    </div>
                  </div>

                  {/* Buy/Sell Tabs */}
                  <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setTradeType('buy')}
                      className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${tradeType === 'buy' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >BUY</button>
                    <button
                      onClick={() => setTradeType('sell')}
                      className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${tradeType === 'sell' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >SELL</button>
                  </div>

                  {/* Quantity Input */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <label>Quantity</label>
                      <span>owned: <span className="text-white">{portfolio?.assets[selectedStock.symbol]?.toLocaleString(undefined, { maximumFractionDigits: 8 }) || 0}</span></span>
                    </div>
                    <input
                      type="number"
                      min="0.00000001"
                      step="any"
                      value={tradeAmount}
                      onChange={(e) => setTradeAmount(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white font-mono focus:outline-none focus:border-yellow-500 transition-colors mb-2"
                    />

                    {/* Quick Trade Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      {tradeType === 'buy' ? (
                        <>
                          <button
                            onClick={() => setTradeAmount(1)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded transition-colors border border-slate-700"
                          >
                            Buy 1
                          </button>
                          <button
                            onClick={() => setTradeAmount(10)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded transition-colors border border-slate-700"
                          >
                            Buy 10
                          </button>
                          <button
                            onClick={() => {
                              const maxQty = Math.floor((portfolio?.cash || 0) / selectedStock.price);
                              setTradeAmount(maxQty);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-yellow-400 text-xs py-1.5 rounded transition-colors border border-slate-700 font-bold"
                          >
                            Max
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              const owned = portfolio?.assets[selectedStock.symbol] || 0;
                              setTradeAmount(parseFloat((owned * 0.25).toFixed(8)));
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded transition-colors border border-slate-700"
                          >
                            25%
                          </button>
                          <button
                            onClick={() => {
                              const owned = portfolio?.assets[selectedStock.symbol] || 0;
                              setTradeAmount(parseFloat((owned * 0.5).toFixed(8)));
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-1.5 rounded transition-colors border border-slate-700"
                          >
                            50%
                          </button>
                          <button
                            onClick={() => {
                              const owned = portfolio?.assets[selectedStock.symbol] || 0;
                              setTradeAmount(owned);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-red-400 text-xs py-1.5 rounded transition-colors border border-slate-700 font-bold"
                          >
                            All
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Total Display */}
                  <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Est. Total</span>
                      <span className="text-white font-bold">${(selectedStock.price * tradeAmount).toFixed(2)}</span>
                    </div>
                    {tradeType === 'buy' && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Available Cash</span>
                        <span>${portfolio?.cash.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Trade Button */}
                  <button
                    onClick={handleTrade}
                    disabled={
                      tradeType === 'buy'
                        ? (portfolio?.cash || 0) < selectedStock.price * tradeAmount
                        : (portfolio?.assets[selectedStock.symbol] || 0) < tradeAmount
                    }
                    className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${tradeType === 'buy'
                      ? 'bg-green-600 hover:bg-green-500 text-white disabled:bg-slate-700 disabled:text-slate-500'
                      : 'bg-red-600 hover:bg-red-500 text-white disabled:bg-slate-700 disabled:text-slate-500'
                      }`}
                  >
                    {tradeType === 'buy' ? '🚀 BUY' : '💰 SELL'}
                  </button>

                  {/* Trade Message */}
                  {tradeMessage && (
                    <div className={`text-center text-sm font-bold py-2 px-3 rounded-lg animate-fade-in ${tradeMessage.includes('✅') ? 'bg-green-900/30 text-green-400 border border-green-700' :
                      tradeMessage.includes('❌') ? 'bg-red-900/30 text-red-400 border border-red-700' :
                        'bg-blue-900/30 text-blue-400 border border-blue-700'
                      }`}>
                      {tradeMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Market List (Mobile: Bottom) */}
        <div className="md:col-span-7 lg:col-span-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
            <h2 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Live Market</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {stocks.map((stock) => (
                <div
                  key={stock.symbol}
                  onClick={() => setSelectedStock(stock)}
                  className={`flex justify-between items-center p-3 md:p-4 rounded-xl cursor-pointer transition-all border min-h-[60px] md:min-h-0 ${selectedStock?.symbol === stock.symbol
                    ? 'bg-yellow-900/20 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)] scale-[1.02]'
                    : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700 hover:scale-[1.01]'
                    }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {/* Asset Type Badge */}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${stock.symbol.includes('-USD')
                        ? 'bg-yellow-900/30 text-yellow-500 border-yellow-700/50'
                        : 'bg-blue-900/30 text-blue-400 border-blue-700/50'
                        }`}>
                        {stock.symbol.includes('-USD') ? 'CRYPTO' : 'STOCK'}
                      </span>
                      <div className="font-bold text-white text-base md:text-sm">{stock.symbol}</div>
                      {/* Trend Indicator */}
                      <span className={`text-xs ${stock.changePercent >= 2 ? 'text-green-400' :
                        stock.changePercent >= 0 ? 'text-green-500/70' :
                          stock.changePercent <= -2 ? 'text-red-400' :
                            'text-red-500/70'
                        }`}>
                        {stock.changePercent >= 0 ? '↗' : '↘'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{stock.name}</div>
                    {(portfolio?.assets[stock.symbol] || 0) > 0 && (
                      <div className="text-xs text-yellow-400 mt-0.5 font-semibold">
                        ✓ {(portfolio?.assets[stock.symbol] || 0).toLocaleString(undefined, { maximumFractionDigits: 8 })} owned
                      </div>
                    )}
                  </div>
                  <div className="text-right ml-2">
                    <PriceDisplay price={stock.price} />
                    <div className={`text-xs font-bold flex items-center justify-end gap-1 ${stock.changePercent >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                      <span>{stock.changePercent >= 0 ? '▲' : '▼'}</span>
                      <span>{stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {(username && ADMIN_USERNAMES.includes(username)) && (
        <DebugControls onRefresh={refreshData} />
      )}
    </div>
  );
};
