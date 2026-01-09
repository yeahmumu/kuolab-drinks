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
  Plus, Minus, Users, BarChart3, Calendar, 
  Trash2, CheckCircle2, Trophy, Clock,
  X, UserPlus, Store, CupSoda, Beer, TrendingUp, Flame,
  History, Filter, ChevronLeft, ChevronRight
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
  const [view, setView] = useState('home'); // 'home' | 'history' | 'stats' | 'members'
  const [orders, setOrders] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
    // 歷史紀錄篩選狀態
  const [monthFilter, setMonthFilter] = useState('all');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());

  // 表單狀態
  const DEFAULT_TIME = "12:00";
  const [newOrder, setNewOrder] = useState({
    store: '',
    date: new Date().toISOString().split('T')[0],
    time: DEFAULT_TIME,
    participants: {} 
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

    // 歷史紀錄篩選邏輯
  const availableMonths = useMemo(() => {
    const months = orders.map(o => o.date.substring(0, 7)); // 取得 YYYY-MM
    return Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  const filteredHistoryOrders = useMemo(() => {
    let result = orders;
    if (monthFilter !== 'all') {
      result = result.filter(o => o.date.startsWith(monthFilter));
    }
    if (selectedCalendarDate) {
      result = result.filter(o => o.date === selectedCalendarDate);
    }
    return result;
  }, [orders, monthFilter, selectedCalendarDate]);

  // 日曆邏輯
  const calendarDays = useMemo(() => {
    const year = currentCalendarMonth.getFullYear();
    const month = currentCalendarMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // 填充空白
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // 填充日期
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        day: i,
        date: dateStr,
        hasOrder: orders.some(o => o.date === dateStr)
      });
    }
    return days;
  }, [currentCalendarMonth, orders]);


  // 修改後的統計邏輯：對齊當前資料結構
  const stats = useMemo(() => {
    const memberRanking = {};
    const storeCounts = {};
    const totalOrdersCount = orders.length;

    orders.forEach(o => {
      // 統計店家次數
      if (o.store) {
        storeCounts[o.store] = (storeCounts[o.store] || 0) + 1;
      }

      // 統計成員杯數 (participants 格式為 { memberId: count })
      Object.entries(o.participants || {}).forEach(([mId, count]) => {
        const member = members.find(m => m.id === mId);
        const name = member ? member.name : "未知成員";
        if (!memberRanking[name]) memberRanking[name] = { count: 0, cups: 0 };
        memberRanking[name].count += 1; // 參加次數
        memberRanking[name].cups += (parseInt(count) || 0); // 總杯數
      });
    });

    const ranking = Object.entries(memberRanking)
      .map(([name, data]) => ({ 
        name, 
        ...data,
        // 計算參與率並四捨五入
        participationRate: totalOrdersCount > 0 
          ? Math.round((data.count / totalOrdersCount) * 100) 
          : 0
      }))
      .sort((a, b) => b.cups - a.cups);

    const topStores = Object.entries(storeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { ranking, topStores, totalOrdersCount };
  }, [orders, members]);

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
      setNewOrder({
        store: '',
        date: new Date().toISOString().split('T')[0],
        time: DEFAULT_TIME,
        participants: {}
      });
      setStoreSearch('');
    } catch (e) { console.error(e); }
  };

  const handleDeleteOrder = async (id) => {
    if (confirm("確定要刪除這筆歷史訂單嗎？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id));
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

  // 修改後：更新數量函式，限制 1~3 杯
  const updateCupCount = (memberId, delta) => {
    setNewOrder(prev => {
      const currentCount = parseInt(prev.participants[memberId]) || 1;
      const newCount = Math.min(3, Math.max(1, currentCount + delta));
      return {
        ...prev,
        participants: { ...prev.participants, [memberId]: newCount }
      };
    });
  };

  const changeCalendarMonth = (offset) => {
    setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.date === todayStr);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
        <p className="mt-4 text-slate-600 font-medium">正在打開飲料紀錄簿...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24 font-sans">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-30 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-orange-500 p-2 rounded-xl text-white shadow-orange-200 shadow-lg">
              <CupSoda size={24} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800">KuoLab 飲料紀錄簿</h1>
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">Daily Drink Tracker</p>
            </div>
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
            onClick={() => setView('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${view === 'history' ? 'bg-white shadow-md text-orange-600' : 'text-slate-500'}`}
          >
            <History size={18} /> 紀錄
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
                  <span className="font-black">今日已登錄</span>
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
                <Plus className="text-orange-500" size={24} strokeWidth={3} /> 新增一筆飲料紀錄
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
                  <div className="w-60">
                    <label className="block text-xs font-black text-slate-400 mb-1 ml-1 uppercase">日期</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-orange-500"
                      value={newOrder.date}
                      onChange={(e) => setNewOrder({...newOrder, date: e.target.value})}
                    />
                  </div>
                  <div className="flex-1">
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
                    const currentCount = parseInt(newOrder.participants[mId]) || 1;
                    return (
                      <div key={mId} className="flex flex-col gap-1 bg-orange-50 border border-orange-100 p-3 rounded-2xl">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-tighter">Cup Count</span>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-black text-orange-700 truncate mr-2">{member?.name}</span>
                          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-orange-200 shadow-sm">
                            <button 
                              onClick={() => updateCupCount(mId, -1)}
                              disabled={currentCount <= 1}
                              className={`p-1 rounded-lg transition-colors ${currentCount <= 1 ? 'text-slate-200' : 'text-orange-500 hover:bg-orange-100'}`}
                            >
                              <Minus size={14} strokeWidth={3} />
                            </button>
                            <span className="text-sm font-black w-4 text-center">{currentCount}</span>
                            <button 
                              onClick={() => updateCupCount(mId, 1)}
                              disabled={currentCount >= 3}
                              className={`p-1 rounded-lg transition-colors ${currentCount >= 3 ? 'text-slate-200' : 'text-orange-500 hover:bg-orange-100'}`}
                            >
                              <Plus size={14} strokeWidth={3} />
                            </button>
                          </div>
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
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
              <h2 className="text-xl font-black flex items-center gap-2">
                <History className="text-orange-500" size={24} /> 歷史團購清單
              </h2>
              
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                <Filter size={16} className="text-slate-400" />
                <select 
                  className="bg-transparent text-sm font-bold focus:outline-none"
                  value={monthFilter}
                  onChange={(e) => {
                    setMonthFilter(e.target.value);
                    setSelectedCalendarDate(null);
                    if (e.target.value !== 'all') {
                      const [y, m] = e.target.value.split('-');
                      setCurrentCalendarMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                    }
                  }}
                >
                  <option value="all">全部顯示</option>
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m.replace('-', ' 年 ')} 月</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 新增：日曆區塊 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-700 flex items-center gap-2">
                  <Calendar size={18} className="text-orange-500" />
                  {currentCalendarMonth.getFullYear()} 年 {currentCalendarMonth.getMonth() + 1} 月
                </h3>
                <div className="flex gap-2">
                  <button onClick={() => changeCalendarMonth(-1)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={() => changeCalendarMonth(1)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-2">
                {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-slate-300 uppercase py-2">{d}</div>
                ))}
                {calendarDays.map((d, i) => (
                  <button
                    key={i}
                    disabled={!d}
                    onClick={() => setSelectedCalendarDate(selectedCalendarDate === d.date ? null : d.date)}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all
                      ${!d ? 'invisible' : 'hover:bg-orange-50'}
                      ${selectedCalendarDate === d?.date ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'text-slate-600'}
                    `}
                  >
                    {d && (
                      <>
                        <span className="text-sm font-bold">{d.day}</span>
                        {d.hasOrder && (
                          <Beer className={`absolute bottom-0.5 w-[35%] h-[35%] sm:w-5 sm:h-5 max-w-[22px] max-h-[22px] ${selectedCalendarDate === d.date ? 'text-white' : 'text-orange-500'}`} /> 
                        )} </> )}
                  </button>
                ))}
              </div>
              {selectedCalendarDate && (
                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={() => setSelectedCalendarDate(null)}
                    className="text-xs font-black text-orange-500 hover:text-orange-600 flex items-center gap-1"
                  >
                    <X size={12} strokeWidth={3} /> 清除日期篩選 ({selectedCalendarDate})
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {filteredHistoryOrders.length > 0 ? (
                filteredHistoryOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="bg-orange-100 p-3 rounded-2xl text-orange-600">
                        <Store size={22} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800">{order.store}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-bold mt-0.5">
                          <span className="flex items-center gap-1"><Calendar size={12} /> {order.date}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {order.time}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full sm:w-auto gap-6 border-t sm:border-t-0 pt-3 sm:pt-0">
                      <div className="text-right">
                        <p className="text-lg font-black text-slate-700">{order.totalCups} <span className="text-xs text-slate-300">杯</span></p>
                        <p className="text-[10px] text-slate-300 font-black uppercase tracking-tighter">Total Amount</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <History size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-slate-400 font-bold">沒有找到相關日期的紀錄</p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === 'stats' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* 核心數據概覽 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-3xl shadow-sm border-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">年度總杯數</p>
                <p className="text-4xl font-black text-orange-500 mt-2">
                  {orders.reduce((acc, o) => acc + o.totalCups, 0)} <span className="text-sm text-slate-300 font-bold">CUPS</span>
                </p>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">總開團次數</p>
                <p className="text-4xl font-black text-slate-800 mt-2">
                  {orders.length} <span className="text-sm text-slate-300 font-bold">TIMES</span>
                </p>
              </div>
            </div>

            {/* 熱門店家區塊 */}
            <div className="space-y-4">
              <h2 className="text-xl font-black px-2 flex items-center gap-2">
                <Flame className="text-orange-500" size={24} /> 熱門店家排行榜
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {stats.topStores.length > 0 ? (
                  stats.topStores.map((s, index) => (
                    <div key={s.name} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Store size={40} />
                      </div>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] mb-3
                        ${index === 0 ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {index + 1}
                      </div>
                      <h4 className="font-bold text-slate-800 truncate mb-1 text-sm">{s.name}</h4>
                      <p className="text-xl font-black text-slate-900">{s.count}<span className="text-[10px] text-slate-400 ml-1 font-medium">次</span></p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full p-8 text-center text-slate-400 italic bg-white rounded-3xl border border-dashed">
                    暫無統計數據
                  </div>
                )}
              </div>
            </div>

            {/* 成員排行清單 */}
            <div className="bg-white rounded-3xl shadow-sm border-none overflow-hidden">
              <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-900 text-white">
                <h2 className="text-xl font-black flex items-center gap-2"><Trophy className="text-amber-400" size={24} /> 飲料大王排行榜</h2>
                <TrendingUp size={24} className="text-orange-400" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[12px] uppercase font-black text-slate-400">
                      <th className="px-6 py-4">排名</th>
                      <th className="px-6 py-4">成員</th>
                      <th className="px-6 py-4">總杯數</th>
                      <th className="px-6 py-4">參與率</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stats.ranking.length > 0 ? stats.ranking.map((r, idx) => (
                      <tr key={r.name} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${idx === 0 ? 'bg-amber-400 text-white shadow-lg' : idx === 1 ? 'bg-slate-300 text-white' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-400'}`}>{idx + 1}</div>
                        </td>
                        <td className="px-6 py-5 font-black text-slate-700">{r.name}</td>
                        <td className="px-6 py-5">
                          <span className="text-orange-500 font-black text-lg">{r.cups}</span><span className="text-xs text-slate-300 ml-1 font-bold">杯</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-700 font-black text-lg">{r.participationRate}%</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                              <div className="bg-orange-400 h-full" style={{ width: `${r.participationRate}%` }}></div>
                            </div>
                          </div>
                          <p className="text-[12px] text-slate-300 font-bold uppercase tracking-tighter">{r.count} / {stats.totalOrdersCount} 次</p>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-400 italic">尚未有飲用紀錄</td></tr>}
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
              <textarea 
                className="w-full p-5 bg-slate-50 border-none rounded-2xl min-h-[120px] outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                placeholder="輸入姓名並使用空格或逗號分隔..."
                value={batchMemberInput}
                onChange={(e) => setBatchMemberInput(e.target.value)}
              />
              <button 
                onClick={handleBatchAddMembers}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 shadow-lg"
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
                  <div key={m.id} className="group flex items-center gap-3 bg-slate-50 px-5 py-3 rounded-2xl text-sm font-black hover:bg-orange-500 hover:text-white transition-all shadow-sm">
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