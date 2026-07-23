import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';

// ⭐️ 1. 어드민 아이디 최신화 완료!
const ADMIN_IDS = ['ch__os', 'CIDER22', 'Zzzxvr'];
const API_BASE = 'https://stock-in-dos.onrender.com';

function App() {
  const [user, setUser] = useState(null);
  const [portfolio, setPortfolio] = useState({ cash: 0, stocks: [] });
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [history, setHistory] = useState([]);
  const [tradeQty, setTradeQty] = useState(''); 
  
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminData, setAdminData] = useState([]);
  const [bankReqs, setBankReqs] = useState([]); 

  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ req_type: '입금', amount: '' });

  // ⭐️ 2. 25분(1500초) 카운트다운 상태 변수
  const UPDATE_INTERVAL = 25 * 60; 
  const [timeLeft, setTimeLeft] = useState(UPDATE_INTERVAL);

  const isAdmin = user && ADMIN_IDS.includes(user.username);

  // ⭐️ 타이머 1초씩 줄어드는 로직
  useEffect(() => {
    const timerId = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? UPDATE_INTERVAL : prev - 1));
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // ⭐️ 초를 분:초(MM:SS) 형식으로 예쁘게 바꿔주는 함수
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleAuth = async (type) => {
    try {
      const url = type === 'login' ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;
      const res = await axios.post(url, authForm);
      if (type === 'login') {
        setUser(res.data);
      } else {
        alert('계좌 개설이 완료되었습니다! 로그인해 주세요.');
        setIsRegisterMode(false);
        setAuthForm({ ...authForm, password: '' });
      }
    } catch (err) {
      alert(err.response?.data?.detail || '오류가 발생했습니다.');
    }
  };

  const logout = () => {
    setUser(null);
    setPortfolio({ cash: 0, stocks: [] });
    setAuthForm({ username: '', password: '' });
    setShowAdmin(false);
  };

  const fetchStocks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/stocks`);
      if (Array.isArray(res.data)) {
        setStocks(res.data);
        setSelectedStock((prev) => {
          if (!prev && res.data.length > 0) return res.data[0];
          if (prev) {
            const updatedSelected = res.data.find(s => s.id === prev.id);
            return updatedSelected || prev;
          }
          return prev;
        });
      }
    } catch (err) {}
  };

  const fetchHistory = async (stockId) => {
    try {
      const res = await axios.get(`${API_BASE}/api/stocks/${stockId}/history`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {}
  };

  const fetchPortfolio = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE}/api/users/${user.user_id}/portfolio`);
      setPortfolio(res.data);
    } catch (err) {}
  };

  const fetchAdminData = async () => {
    try {
      const resData = await axios.get(`${API_BASE}/api/admin/dashboard?username=${user.username}`);
      const resBank = await axios.get(`${API_BASE}/api/admin/bank?username=${user.username}`);
      setAdminData(resData.data);
      setBankReqs(resBank.data);
      setShowAdmin(true);
    } catch (err) {
      alert("어드민 데이터를 불러올 수 없습니다.");
    }
  };

  const handleTrade = async (tradeType) => {
    const qty = Number(tradeQty);
    if (qty <= 0 || !Number.isInteger(qty)) {
      alert("정확한 수량을 입력해주세요."); return;
    }
    try {
      const endpoint = tradeType === 'buy' ? '/api/trade/buy' : '/api/trade/sell';
      const res = await axios.post(`${API_BASE}${endpoint}`, {
        user_id: user.user_id, stock_id: selectedStock.id, quantity: qty
      });
      alert(res.data.message);
      setTradeQty('');
      fetchPortfolio();
    } catch (err) {
      alert(err.response?.data?.detail || "거래 중 오류가 발생했습니다.");
    }
  };

  const submitBankRequest = async () => {
    const amt = Number(bankForm.amount);
    if (amt <= 0 || !Number.isInteger(amt)) {
      alert("정확한 금액을 입력해주세요."); return;
    }
    if (bankForm.req_type === '출금' && amt > portfolio.cash) {
      alert("보유 현금보다 많이 출금할 수 없습니다!"); return;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/bank/request`, {
        username: user.username, req_type: bankForm.req_type, amount: amt
      });
      alert(`${res.data.message}\n디스코드 채널에 스크린샷을 꼭 남겨주세요! 어드민 확인 후 처리됩니다.`);
      setShowBankForm(false);
      setBankForm({ ...bankForm, amount: '' });
    } catch (err) {
      alert("신청 중 오류가 발생했습니다.");
    }
  };

  const processBankRequest = async (req_id, action) => {
    try {
      const res = await axios.post(`${API_BASE}/api/admin/bank/process`, {
        admin_name: user.username, req_id: req_id, action: action
      });
      alert(res.data.message);
      fetchAdminData();
    } catch (err) {
      alert(err.response?.data?.detail || "처리 실패");
    }
  };

  useEffect(() => {
    if (user && !showAdmin) {
      fetchStocks();
      fetchPortfolio();
      const interval = setInterval(() => { fetchStocks(); fetchPortfolio(); }, 5000);
      return () => clearInterval(interval);
    }
  }, [user, showAdmin]);

  useEffect(() => {
    if (selectedStock) fetchHistory(selectedStock.id);
  }, [selectedStock?.id]);

  const chartSeries = [{
    name: selectedStock ? selectedStock.name : '시세',
    data: history.map(item => ({ x: new Date(item.recorded_at).getTime(), y: item.price }))
  }];
  const chartOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false }, animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } } },
    theme: { mode: 'dark' }, xaxis: { type: 'datetime', labels: { style: { colors: '#8b9bb4' } } },
    yaxis: { labels: { formatter: (val) => val ? val.toLocaleString() + '원' : '', style: { colors: '#8b9bb4' } } },
    stroke: { curve: 'smooth', width: 3, colors: ['#D4AF37'] },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, colors: ['#D4AF37'] } }, colors: ['#D4AF37'], grid: { borderColor: '#1e293b', strokeDashArray: 4 }
  };
  const inputStyle = { width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #1C2541', backgroundColor: '#0B132B', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0B132B', color: '#fff', fontFamily: "'Pretendard', sans-serif" }}>
        <div style={{ backgroundColor: '#111936', padding: '50px', borderRadius: '20px', border: '1px solid #1C2541', width: '400px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ width: '60px', height: '60px', backgroundColor: '#D4AF37', borderRadius: '12px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B132B', fontWeight: '900', fontSize: '30px' }}>D</div>
          <h2 style={{ marginBottom: '10px', color: '#fff' }}>DOS 증권 거래소</h2>
          <div style={{ marginTop: '30px' }}>
            <input type="text" placeholder="마인크래프트 닉네임" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} style={inputStyle} />
            <input type="password" placeholder="비밀번호" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} style={{...inputStyle, marginBottom: '30px'}} />
            <button onClick={() => handleAuth(isRegisterMode ? 'register' : 'login')} style={{ width: '100%', padding: '15px', backgroundColor: isRegisterMode ? '#1C2541' : '#D4AF37', color: isRegisterMode ? '#fff' : '#0B132B', border: isRegisterMode ? '1px solid #D4AF37' : 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>
              {isRegisterMode ? '회원가입 완료' : '로그인'}
            </button>
            <div style={{ marginTop: '20px', color: '#8b9bb4', fontSize: '0.9rem' }}>
              <span onClick={() => setIsRegisterMode(!isRegisterMode)} style={{ color: '#D4AF37', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>
                {isRegisterMode ? '이미 계좌가 있으신가요?' : '아직 계좌가 없으신가요?'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0B132B', color: '#ffffff', padding: '40px 20px', fontFamily: "'Pretendard', sans-serif" }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ color: '#D4AF37' }}>⚙️ 운영자 전용 유저 감시 패널</h1>
            <button onClick={() => setShowAdmin(false)} style={{ padding: '10px 20px', backgroundColor: '#1C2541', color: '#fff', border: '1px solid #8b9bb4', borderRadius: '8px', cursor: 'pointer' }}>거래소로 돌아가기</button>
          </div>
          
          <div style={{ backgroundColor: '#111936', borderRadius: '16px', border: '1px solid #1C2541', padding: '20px', marginBottom: '30px' }}>
            <h2 style={{ color: '#fff', marginBottom: '20px', fontSize: '1.2rem' }}>💰 입출금 승인 대기 목록</h2>
            {bankReqs.length === 0 ? (
              <div style={{ color: '#8b9bb4' }}>현재 대기 중인 요청이 없습니다.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1C2541', color: '#8b9bb4' }}>
                    <th style={{ padding: '10px' }}>닉네임</th><th style={{ padding: '10px' }}>구분</th><th style={{ padding: '10px' }}>금액</th><th style={{ padding: '10px' }}>승인 / 거절</th>
                  </tr>
                </thead>
                <tbody>
                  {bankReqs.map(req => (
                    <tr key={req.id} style={{ borderBottom: '1px solid #1C2541' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{req.username}</td>
                      <td style={{ padding: '10px', color: req.req_type === '입금' ? '#ff4d4f' : '#3b82f6', fontWeight: 'bold' }}>{req.req_type}</td>
                      <td style={{ padding: '10px' }}>{req.amount.toLocaleString()}원</td>
                      <td style={{ padding: '10px', display: 'flex', gap: '10px' }}>
                        <button onClick={() => processBankRequest(req.id, '승인')} style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>승인</button>
                        <button onClick={() => processBankRequest(req.id, '거절')} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>거절</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ backgroundColor: '#111936', borderRadius: '16px', border: '1px solid #1C2541', padding: '20px', overflowX: 'auto' }}>
            <h2 style={{ color: '#fff', marginBottom: '20px', fontSize: '1.2rem' }}>🏆 유저 자산 랭킹</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1C2541', color: '#8b9bb4' }}>
                  <th style={{ padding: '15px' }}>랭킹</th><th style={{ padding: '15px' }}>닉네임</th><th style={{ padding: '15px', color: '#D4AF37' }}>총 자산 (현금+주식)</th><th style={{ padding: '15px' }}>보유 현금</th><th style={{ padding: '15px' }}>보유 주식 목록</th>
                </tr>
              </thead>
              <tbody>
                {adminData.map((data, index) => (
                  <tr key={data.username} style={{ borderBottom: '1px solid #1C2541' }}>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{index + 1}위</td><td style={{ padding: '15px', fontWeight: 'bold' }}>{data.username}</td><td style={{ padding: '15px', color: '#D4AF37', fontWeight: 'bold' }}>{data.total_assets.toLocaleString()}원</td><td style={{ padding: '15px' }}>{data.cash.toLocaleString()}원</td><td style={{ padding: '15px', fontSize: '0.9rem', color: '#8b9bb4' }}>{data.holdings.length > 0 ? data.holdings.join(', ') : '없음'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const ownedStock = portfolio.stocks.find(s => s.id === selectedStock?.id);
  const myQty = ownedStock ? ownedStock.quantity : 0;
  const totalPrice = selectedStock ? (selectedStock.current_price * (Number(tradeQty) || 0)) : 0;

  let totalInvested = 0;
  let totalCurrentValue = 0;
  portfolio.stocks.forEach(s => {
    totalInvested += (s.average_price * s.quantity);
    totalCurrentValue += (s.current_price * s.quantity);
  });
  const totalProfit = totalCurrentValue - totalInvested;
  const totalReturnRate = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const totalAssets = portfolio.cash + totalCurrentValue;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B132B', color: '#ffffff', padding: '40px 20px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#D4AF37', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B132B', fontWeight: '900', fontSize: '20px' }}>D</div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', whiteSpace: 'nowrap' }}>DOS 증권 거래소</h1>
          </div>
          
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            
            {/* ⭐️ 총 수익률 요약 패널 + 25분 타이머 추가 */}
            <div style={{ backgroundColor: '#111936', padding: '20px 25px', borderRadius: '16px', border: '1px solid #1C2541', minWidth: '260px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#8b9bb4', fontSize: '1rem', fontWeight: 'bold' }}>📊 내 총 주식 수익률</span>
                {/* ⭐️ 타이머 뱃지 */}
                <div style={{ backgroundColor: '#1C2541', padding: '5px 12px', borderRadius: '20px', border: '1px solid #D4AF37', color: '#D4AF37', fontWeight: 'bold', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  ⏳ 다음 변동 {formatTime(timeLeft)}
                </div>
              </div>

              <div style={{ fontSize: '2.8rem', fontWeight: '900', color: totalReturnRate > 0 ? '#ff4d4f' : totalReturnRate < 0 ? '#3b82f6' : '#fff', marginBottom: '5px' }}>
                {totalReturnRate > 0 ? '+' : ''}{totalReturnRate.toFixed(2)}%
              </div>
              <div style={{ color: totalProfit > 0 ? '#ff4d4f' : totalProfit < 0 ? '#3b82f6' : '#8b9bb4', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '15px' }}>
                {totalProfit > 0 ? '▲' : totalProfit < 0 ? '▼' : ''} {Math.abs(totalProfit).toLocaleString()} 원
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid #1C2541' }}>
                <span style={{ color: '#8b9bb4', fontSize: '0.9rem' }}>총 자산 (현금+주식): </span>
                <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>{totalAssets.toLocaleString()} 원</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#111936', padding: '20px 25px', borderRadius: '16px', border: '1px solid #1C2541', minWidth: '280px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C2541', paddingBottom: '10px', marginBottom: '15px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>👑 {user.username} 님</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {isAdmin && <button onClick={fetchAdminData} style={{ backgroundColor: '#D4AF37', color: '#0B132B', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>⚙️ 어드민 패널</button>}
                  <button onClick={logout} style={{ backgroundColor: 'transparent', color: '#8b9bb4', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>로그아웃</button>
                </div>
              </div>
              
              <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <span style={{ color: '#8b9bb4', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>보유 현금 (KRW)</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#D4AF37' }}>{portfolio.cash.toLocaleString()}원</span>
                </div>
                <button onClick={() => setShowBankForm(!showBankForm)} style={{ padding: '6px 12px', backgroundColor: '#1C2541', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>입출금 뱅킹</button>
              </div>

              {showBankForm && (
                <div style={{ backgroundColor: '#0B132B', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #1C2541' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <button onClick={() => setBankForm({...bankForm, req_type: '입금'})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: bankForm.req_type === '입금' ? '#ff4d4f' : '#1C2541', color: '#fff' }}>입금 신청</button>
                    <button onClick={() => setBankForm({...bankForm, req_type: '출금'})} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: bankForm.req_type === '출금' ? '#3b82f6' : '#1C2541', color: '#fff' }}>출금 신청</button>
                  </div>
                  <input type="number" placeholder="금액 입력" value={bankForm.amount} onChange={e => setBankForm({...bankForm, amount: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #1C2541', backgroundColor: '#111936', color: '#fff', marginBottom: '10px', boxSizing: 'border-box' }} />
                  <button onClick={submitBankRequest} style={{ width: '100%', padding: '10px', backgroundColor: '#D4AF37', color: '#0B132B', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>신청하기 (디코 스샷 필수)</button>
                </div>
              )}

              <div>
                <span style={{ color: '#8b9bb4', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>보유 주식 내역</span>
                {portfolio.stocks.length === 0 ? (
                  <div style={{ color: '#5a6b8a', fontSize: '0.9rem' }}>보유중인 주식이 없습니다.</div>
                ) : (
                  portfolio.stocks.map((s, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.95rem' }}>
                      <span style={{ color: '#fff' }}>{s.name}</span>
                      <div>
                        <span style={{ color: s.return_rate > 0 ? '#ff4d4f' : s.return_rate < 0 ? '#3b82f6' : '#8b9bb4', marginRight: '10px', fontSize: '0.85rem' }}>
                          {s.return_rate > 0 ? '▲' : s.return_rate < 0 ? '▼' : '-'} {s.return_rate}%
                        </span>
                        <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>{s.quantity}주</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {stocks.map(stock => {
            const isSelected = selectedStock?.id === stock.id;
            return (
              <div key={stock.id} onClick={() => { setSelectedStock(stock); setTradeQty(''); }}
                style={{ padding: '24px', borderRadius: '16px', backgroundColor: isSelected ? '#152243' : '#111936', border: isSelected ? '2px solid #D4AF37' : '2px solid #1C2541', cursor: 'pointer', boxShadow: isSelected ? '0 8px 24px rgba(212, 175, 55, 0.15)' : '0 4px 12px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.4rem', color: '#fff' }}>{stock.name}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: isSelected ? '#D4AF37' : '#fff' }}>{stock.current_price ? stock.current_price.toLocaleString() : 0} KRW</div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedStock && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: '#111936', border: '1px solid #1C2541', padding: '30px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div><h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#fff' }}>{selectedStock.name} 차트</h2></div>
                <div style={{ textAlign: 'right' }}><h2 style={{ margin: 0, color: '#D4AF37', fontSize: '2rem' }}>{selectedStock.current_price ? selectedStock.current_price.toLocaleString() : 0}원</h2></div>
              </div>
              <Chart options={chartOptions} series={chartSeries} type="area" height={400} />
            </div>

            <div style={{ backgroundColor: '#111936', border: '1px solid #1C2541', padding: '30px', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', borderBottom: '1px solid #1C2541', paddingBottom: '15px' }}>주문 패널</h2>
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', color: '#8b9bb4', fontSize: '0.95rem' }}>
                <span>현재 보유 수량:</span><span style={{ color: '#fff', fontWeight: 'bold' }}>{myQty}주</span>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button onClick={() => setTradeQty(Math.floor(portfolio.cash / selectedStock.current_price))} style={{ flex: 1, padding: '8px', backgroundColor: '#1C2541', border: 'none', color: '#8b9bb4', borderRadius: '6px', cursor: 'pointer' }}>최대 매수</button>
                  <button onClick={() => setTradeQty(myQty)} style={{ flex: 1, padding: '8px', backgroundColor: '#1C2541', border: 'none', color: '#8b9bb4', borderRadius: '6px', cursor: 'pointer' }}>전량 매도</button>
                </div>
                <input type="number" placeholder="수량 (주)" value={tradeQty} onChange={e => setTradeQty(e.target.value)} style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #1C2541', backgroundColor: '#0B132B', color: '#fff', fontSize: '1.2rem', textAlign: 'right', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', backgroundColor: '#0B132B', padding: '15px', borderRadius: '8px' }}>
                <span style={{ color: '#8b9bb4' }}>총 결제 금액</span><span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' }}>{totalPrice.toLocaleString()} 원</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                <button onClick={() => handleTrade('buy')} style={{ flex: 1, padding: '18px', backgroundColor: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>매 수</button>
                <button onClick={() => handleTrade('sell')} style={{ flex: 1, padding: '18px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>매 도</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;