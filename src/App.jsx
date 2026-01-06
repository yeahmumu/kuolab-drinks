import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, getDoc, 
  onSnapshot, addDoc, updateDoc, deleteDoc, query 
} from 'firebase/firestore';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Plus, Users, BarChart3, Calendar, 
  Trash2, CheckCircle2, Trophy, Clock,
  X, UserPlus, Store, CupSoda
} from 'lucide-react';

// --- Firebase 配置 (由環境提供) ---
const firebaseConfig = {
  apiKey: "AIzaSyCgpqBmma4TGHslVozi4i5kdUKmRQVMOHg",
  authDomain: "drinkkuolab.firebaseapp.com",
  projectId: "drinkkuolab",
  storageBucket: "drinkkuolab.firebasestorage.app",
  messagingSenderId: "520180107286",
  appId: "1:520180107286:web:51c06350c0b73d70620d37"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'drink-order-manager-2026';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // 'home' | 'stats' | 'members'
  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 表單狀態 - 將時間預設固定在 12:00
  const DEFAULT_TIME = "12:00";
  const [newOrder, setNewOrder] = useState({
    store: '',
    date: new Date().toISOString().split('T')[0],
    time: DEFAULT_TIME,
    participants: {} // { memberId: count }
  });
  const [storeSearch, setStoreSearch] = useState('');
  const [showStoreSuggestions, setShowStoreSuggestions] = useState(false);
  const [batchMemberInput, setBatchMemberInput] = useState('');

  // 1. 初始化 Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 監聽 Firestore 資料
  useEffect(() => {
    if (!user) return;

    const ordersRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
    const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'members');

    const unsubOrders = onSnapshot(ordersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data.sort((a, b) => b.timestamp - a.timestamp));
      setLoading(false);
    }, (err) => console.error("Firestore Orders Error:", err));

    const unsubMembers = onSnapshot(membersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembers(data.sort((a, b) => a.name.localeCompare(b.name)));
    }, (err) => console.error("Firestore Members Error:", err));

    return () => {
      unsubOrders();
      unsubMembers();
    };
  }, [user]);

  // --- 邏輯處理 ---

  const storeSuggestions = useMemo(() => {
    const history = Array.from(new Set(orders.map(o => o.store)));
    if (!storeSearch) return [];
    return history.filter(s => s.toLowerCase().includes(storeSearch.toLowerCase()));
  }, [orders, storeSearch]);

  const handleAddOrder = async () => {
    if (!newOrder.store || Object.keys(newOrder.participants).length === 0) return;
    
    try {
      const totalCups = Object.values(newOrder.participants).reduce((a, b) => a + (parseInt(b) || 0), 0);
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), {
        ...newOrder,
        totalCups,
        timestamp: Date.now(),
        createdBy: user.uid
      });
      // Reset form
      setNewOrder({
        store: '',
        date: new Date().toISOString().split('T')[0],
        time: DEFAULT_TIME,
        participants: {}
      });
      setStoreSearch('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleBatchAddMembers = async () => {
    const names = batchMemberInput.split(/[\s,，]+/).filter(n => n.trim());
    for (const name of names) {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'members'), {
        name: name.trim(),
        active: true
      });
    }
    setBatchMemberInput('');
  };

  const toggleParticipant = (memberId) => {
    setNewOrder(prev => {
      const newParticipants = { ...prev.participants };
      if (newParticipants[memberId] !== undefined) {
        delete newParticipants[memberId];
      } else {
        newParticipants[memberId] = 1;
      }
      return { ...prev, participants: newParticipants };
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.date === todayStr);

  const stats = useMemo(() => {
    const ranking = {};
    const storeStats = {};
    orders.forEach(o => {
      storeStats[o.store] = (storeStats[o.store] || 0) + 1;
      Object.entries(o.participants).forEach(([mId, count]) => {
        const m = members.find(member => member.id === mId);
        const name = m ? m.name : "未知用戶";
        if (!ranking[name]) ranking[name] = { count: 0, cups: 0 };
        ranking[name].count += 1;
        ranking[name].cups += (parseInt(count) || 0);
      });
    });
    return { 
      ranking: Object.entries(ranking).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.cups - a.cups),
      storeStats 
    };
  }, [orders, members]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-slate-600 font-medium">正在打開紀錄簿...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      {/* Header - 更新 Logo 與樣式 */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-2 rounded-xl text-white shadow-orange-200 shadow-lg">
              <CupSoda size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">KuoLab 飲料紀錄簿</h1>
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">Daily Drink Tracker</p>
            </div>
          </div>
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            LIVE SYNC ACTIVE
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-200 p-1 rounded-2xl w-full max-w-sm mx-auto shadow-inner">
          <button 
            onClick={() => setView('home')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${view === 'home' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500'}`}
          >
            <Plus size={18} /> 登記
          </button>
          <button 
            onClick={() => setView('stats')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${view === 'stats' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500'}`}
          >
            <BarChart3 size={18} /> 統計
          </button>
          <button 
            onClick={() => setView('members')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${view === 'members' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500'}`}
          >
            <Users size={18} /> 名單
          </button>
        </div>

        {view === 'home' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Today Summary */}
            {todayOrders.length > 0 && (
              <div className="bg-orange-50 border border-orange-100 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-orange-700 mb-4">
                  <Clock size={20} />
                  <span className="font-black">今日已登錄訂單</span>
                </div>
                <div className="space-y-3">
                  {todayOrders.map(order => (
                    <div key={order.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-8 bg-orange-400 rounded-full"></div>
                        <div>
                          <p className="font-black text-slate-800">{order.store}</p>
                          <p className="text-xs text-slate-400">{order.time} 登記</p>
                        </div>
                      </div>
                      <div className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-black">
                        {order.totalCups} 杯
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Order Form */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 space-y-6">
              <h2 className="text-xl font-black flex items-center gap-2 text-slate-800">
                <Plus className="text-orange-500" size={24} strokeWidth={3} /> 新增今日團購
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="relative">
                  <label className="block text-xs font-black text-slate-400 mb-1 ml-1 uppercase">飲料店家</label>
                  <div className="relative">
                    <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      type="text" 
                      placeholder="搜尋或輸入店名..."
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-bold"
                      value={storeSearch}
                      onChange={(e) => {
                        setStoreSearch(e.target.value);
                        setNewOrder({...newOrder, store: e.target.value});
                        setShowStoreSuggestions(true);
                      }}
                    />
                  </div>
                  {showStoreSuggestions && storeSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full mt-2 bg-white border rounded-2xl shadow-2xl overflow-hidden p-2">
                      {storeSuggestions.map(s => (
                        <button 
                          key={s}
                          className="w-full text-left px-4 py-3 hover:bg-orange-50 rounded-xl text-sm font-bold transition-colors"
                          onClick={() => {
                            setNewOrder({...newOrder, store: s});
                            setStoreSearch(s);
                            setShowStoreSuggestions(false);
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-black text-slate-400 mb-1 ml-1 uppercase">日期</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                      value={newOrder.date}
                      onChange={(e) => setNewOrder({...newOrder, date: e.target.value})}
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs font-black text-slate-400 mb-1 ml-1 uppercase">時間</label>
                    <input 
                      type="time" 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold opacity-70 cursor-not-allowed"
                      value={newOrder.time}
                      disabled
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 mb-3 ml-1 uppercase">選擇成員</label>
                <div className="flex flex-wrap gap-2 mb-6">
                  {members.map(m => {
                    const isSelected = newOrder.participants[m.id] !== undefined;
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleParticipant(m.id)}
                        className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 ${
                          isSelected 
                            ? 'bg-orange-500 text-white shadow-orange-200 shadow-lg scale-105' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {m.name}
                        {isSelected && <CheckCircle2 size={16} />}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Object.keys(newOrder.participants).map(mId => {
                    const member = members.find(m => m.id === mId);
                    return (
                      <div key={mId} className="flex flex-col gap-1 bg-orange-50 border border-orange-100 p-3 rounded-2xl">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">Cup Count</span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-orange-700 truncate mr-2">{member?.name}</span>
                          <input 
                            type="number" 
                            min="1"
                            className="w-12 py-1 text-center bg-white border border-orange-200 rounded-xl text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                            value={newOrder.participants[mId]}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewOrder(prev => ({
                                ...prev,
                                participants: { ...prev.participants, [mId]: val }
                              }));
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleAddOrder}
                disabled={!newOrder.store || Object.keys(newOrder.participants).length === 0}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 disabled:opacity-30 disabled:grayscale transition-all shadow-xl active:scale-[0.98]"
              >
                確認儲存今日訂單
              </button>
            </div>

            {/* History List */}
            <div className="space-y-4">
              <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest ml-1">歷史紀錄</h3>
              <div className="grid grid-cols-1 gap-4">
                {orders.slice(0, 5).map(o => (
                  <div key={o.id} className="bg-white border-none rounded-3xl p-5 flex gap-5 items-center shadow-sm group hover:shadow-md transition-all">
                    <div className="bg-slate-50 p-4 rounded-2xl text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                      <Calendar size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-black text-slate-800 text-lg">{o.store}</h4>
                          <p className="text-xs font-bold text-slate-400">{o.date} · {o.time}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black text-orange-500">{o.totalCups}</span>
                          <span className="text-xs font-bold text-slate-400 ml-1">杯</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        if (confirm('確定要刪除這筆紀錄嗎？')) {
                          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', o.id));
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'stats' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">年度總杯數</p>
                <p className="text-4xl font-black text-orange-500 mt-2">
                  {orders.reduce((acc, o) => acc + o.totalCups, 0)} <span className="text-sm text-slate-300">CUPS</span>
                </p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">總次數</p>
                <p className="text-4xl font-black text-slate-800 mt-2">
                  {orders.length} <span className="text-sm text-slate-300">TIMES</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border-none overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <Trophy className="text-amber-400" size={24} /> 飲料大王排行榜
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400">
                      <th className="px-6 py-4">排名</th>
                      <th className="px-6 py-4">成員</th>
                      <th className="px-6 py-4">總杯數</th>
                      <th className="px-6 py-4">參加率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.ranking.map((r, idx) => (
                      <tr key={r.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                            idx === 0 ? 'bg-amber-400 text-white shadow-lg' : 
                            idx === 1 ? 'bg-slate-300 text-white' :
                            idx === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-6 py-5 font-black text-slate-700">{r.name}</td>
                        <td className="px-6 py-5">
                          <span className="text-orange-500 font-black text-lg">{r.cups}</span>
                        </td>
                        <td className="px-6 py-5 text-slate-400 text-sm font-bold">{r.count} 次</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'members' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl shadow-xl border-none p-6 space-y-4">
              <h2 className="text-xl font-black flex items-center gap-2">
                <UserPlus className="text-orange-500" size={24} /> 新增成員
              </h2>
              <p className="text-xs font-bold text-slate-400">
                請輸入姓名並使用空格或逗號分隔，例如：「小明 小華 大壯」
              </p>
              <textarea 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl min-h-[120px] outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                placeholder="在此貼上名單..."
                value={batchMemberInput}
                onChange={(e) => setBatchMemberInput(e.target.value)}
              />
              <button 
                onClick={handleBatchAddMembers}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 shadow-lg active:scale-[0.98]"
              >
                儲存成員名單
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm p-6 border-none">
              <h2 className="text-xl font-black mb-5 flex items-center gap-2 text-slate-800">
                <Users className="text-orange-500" size={24} /> 現有成員 ({members.length})
              </h2>
              <div className="flex flex-wrap gap-3">
                {members.map(m => (
                  <div key={m.id} className="group flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl text-sm font-black hover:bg-orange-500 hover:text-white transition-all cursor-default shadow-sm hover:shadow-orange-200">
                    {m.name}
                    <button 
                      onClick={async () => {
                        if(confirm(`確定要移除 ${m.name} 嗎？`)) {
                          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'members', m.id));
                        }
                      }}
                      className="text-slate-300 group-hover:text-white transition-colors"
                    >
                      <X size={16} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      <div className="text-center p-8 text-slate-300 text-[10px] font-black tracking-widest uppercase">
        Drink Responsibly · KuoLab 2026
      </div>
    </div>
  );
};

export default App;