import { useState, useEffect } from 'react';
import { api } from '../api';

interface LeaderboardEntry {
    userId: string;
    username: string;
    value: number;
}

interface HistoryEntry {
    ticker: string;
    amount: number;
    price: number;
    type: 'buy' | 'sell';
    timestamp: number;
}

export const Leaderboard = ({ onClose, currentUserId }: { onClose: () => void; currentUserId?: string }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<string | null>(null); // Username for display
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchLeaderboard = () => {
            api.getLeaderboard().then(data => {
                setEntries(data.leaderboard);
                setLoading(false);
            }).catch(console.error);
        };

        fetchLeaderboard();
        const interval = setInterval(fetchLeaderboard, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    const handleUserClick = async (userId: string, username: string) => {
        setSelectedUser(username);
        setLoadingHistory(true);
        try {
            // Use getMyHistory if viewing own history, otherwise getUserHistory
            const res = userId === currentUserId
                ? await api.getMyHistory()
                : await api.getUserHistory(userId);
            setHistory(res.history);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistory(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slide-in">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-800">
                    <h2 className="text-xl font-black text-yellow-500 flex items-center gap-2">
                        {selectedUser ? (
                            <>
                                <button
                                    onClick={() => setSelectedUser(null)}
                                    className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-lg transition-all hover:scale-110"
                                >
                                    ←
                                </button>
                                <span className="truncate max-w-[200px]">{selectedUser}</span>
                            </>
                        ) : (
                            <>
                                <span>🏆 Leaderboard</span>
                            </>
                        )}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 hover:rotate-90"
                    >
                        &times;
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 md:p-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    {selectedUser ? (
                        /* History View */
                        loadingHistory ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
                                <span className="text-4xl mb-2 animate-pulse">⏳</span>
                                <div className="animate-pulse">Loading history...</div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {history.length === 0 ? (
                                    <div className="text-center text-slate-500 py-12 flex flex-col items-center">
                                        <span className="text-5xl mb-3 opacity-20">📜</span>
                                        <span className="text-sm">No trading history yet.</span>
                                        <span className="text-xs text-slate-600 mt-1">Make your first trade to see it here!</span>
                                    </div>
                                ) : (
                                    history.map((entry, index) => (
                                        <div key={index} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center shadow-sm">
                                            <div>
                                                <div className="font-bold text-white flex gap-2 items-center">
                                                    <span className={`text-xs font-black px-1.5 py-0.5 rounded uppercase ${entry.type === 'buy' ? 'bg-green-900/30 text-green-400 border border-green-900' : 'bg-red-900/30 text-red-400 border border-red-900'}`}>
                                                        {entry.type}
                                                    </span>
                                                    <span>{entry.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} <span className="text-slate-400">{entry.ticker}</span></span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                                                    {new Date(entry.timestamp).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-mono text-white font-bold">${entry.price.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )
                    ) : (
                        /* Leaderboard View */
                        loading ? (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-500 animate-pulse">
                                <div>Loading rankings...</div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {entries.map((entry, index) => (
                                    <div
                                        key={index}
                                        onClick={() => handleUserClick(entry.userId, entry.username)}
                                        className={`flex justify-between items-center p-3 rounded-xl cursor-pointer hover:bg-slate-800 transition-all border ${index === 0 ? 'bg-yellow-900/10 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]' :
                                            index === 1 ? 'bg-slate-800/50 border-slate-700' :
                                                index === 2 ? 'bg-slate-800/30 border-slate-800' :
                                                    'bg-transparent border-transparent hover:border-slate-800'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`font-black w-8 h-8 flex items-center justify-center rounded-lg text-sm ${index === 0 ? 'bg-yellow-500 text-black' :
                                                index === 1 ? 'bg-slate-400 text-black' :
                                                    index === 2 ? 'bg-orange-700 text-white' :
                                                        'bg-slate-800 text-slate-500'
                                                }`}>
                                                {index + 1}
                                            </div>
                                            <div>
                                                <div className="text-white font-bold text-sm md:text-base hover:text-yellow-400 transition-colors">
                                                    {entry.username.replace('user:', '').replace(':portfolio', '')}
                                                </div>
                                                {index === 0 && <div className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Top Trader</div>}
                                            </div>
                                        </div>
                                        <div className="font-mono font-bold text-green-400 text-sm md:text-base">
                                            ${entry.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                    </div>
                                ))}
                                {entries.length === 0 && (
                                    <div className="text-center text-slate-500 py-12">No trades yet!</div>
                                )}
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};
