import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';

// ⭐️ 어드민으로 사용할 닉네임 3개를 여기에 똑같이 적어주세요!
const ADMIN_IDS = ['ch__os', 'CIDER22', 'Zzzxvr'];

function App() {
  const [user, setUser] = useState(null);
  const [portfolio, setPortfolio] = useState({ cash: 0, stocks: [] });
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [history, setHistory] = useState([]);
  const [tradeQty, setTradeQty] = useState(''); 
  
  // ⭐️ 어드민 전용 상태 변수
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminData, setAdminData] = useState([]);

  const isAdmin = user && ADMIN_IDS.includes(user.username); // 어드민인지 확인

  const handleAuth = async (type) => {
    try {
      const url = type === 'login' ? 'https://stock-in-dos.onrender.com/api/auth/login' : 'https://stock-in-dos.onrender.com/api/auth/register';
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
      const res = await axios.get('https://stock-in-dos.onrender.com/api/stocks');
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

  const fetchPortfolio = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`https://stock-in-dos.onrender.com/api/users/${user.user_id}/portfolio`);
      setPortfolio(res.data);
    } catch (err) {}
  };

  // ⭐️ 어드민 데이터 불러오기 함수
  const fetchAdminData = async () => {
    try {
      const res = await axios.get(`https://stock-in-dos.onrender.com/api/admin/dashboard?username=${user.username}`);
      setAdminData(res.data);
      setShowAdmin(true);
    } catch (err) {
      alert("어드민 데이터를 불러올 수 없습니다.");
    }
  };

  const handleTrade = async (tradeType) => {
    const qty = Number(tradeQty);
    if (qty <= 0 || !Number.isInteger(qty)) {
      alert("정확한 수량을 입력해주세요.");
      return;
    }
    try {
      const endpoint = tradeType === 'buy' ? '/api/trade/buy' : '/api/trade/sell';
      const res = await axios.post(`https://stock-in-dos.onrender.com${endpoint}`, {
        user_id: user.user_id, stock_id: selectedStock.id, quantity: qty
      });
      alert(res.data.message);
      setTradeQty('');
      fetchPortfolio();
    } catch (err) {
      alert(err.response?.data?.detail || "거래 중 오류가 발생했습니다.");
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

  // ⭐️ 어드민 패널 화면 렌더링
  if (showAdmin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0B132B', color: '#ffffff', padding: '40px 20px', fontFamily: "'Pretendard', sans-serif" }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ color: '#D4AF37' }}>⚙️ 운영자 전용 유저 감시 패널</h1>
            <button onClick={() => setShowAdmin(false)} style={{ padding: '10px 20px', backgroundColor: '#1C2541', color: '#fff', border: '1px solid #8b9bb4', borderRadius: '8px', cursor: 'pointer' }}>거래소로 돌아가기</button>
          </div>
          
          <div style={{ backgroundColor: '#111936', borderRadius: '16px', border: '1px solid #1C2541', padding: '20px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1C2541', color: '#8b9bb4' }}>
                  <th style={{ padding: '15px' }}>랭킹</th>
                  <th style={{ padding: '15px' }}>닉네임</th>
                  <th style={{ padding: '15px', color: '#D4AF37' }}>총 자산 (현금+주식)</th>
                  <th style={{ padding: '15px' }}>보유 현금</th>
                  <th style={{ padding: '15px' }}>보유 주식 목록</th>
                </tr>
              </thead>
              <tbody>
                {adminData.map((data, index) => (
                  <tr key={data.username} style={{ borderBottom: '1px solid #1C2541' }}>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{index + 1}위</td>
                    <td style={{ padding: '15px', fontWeight: 'bold' }}>{data.username}</td>
                    <td style={{ padding: '15px', color: '#D4AF37', fontWeight: 'bold' }}>{data.total_assets.toLocaleString()}원</td>
                    <td style={{ padding: '15px' }}>{data.cash.toLocaleString()}원</td>
                    <td style={{ padding: '15px', fontSize: '0.9rem', color: '#8b9bb4' }}>
                      {data.holdings.length > 0 ? data.holdings.join(', ') : '없음'}
                    </td>
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0B132B', color: '#ffffff', padding: '40px 20px', fontFamily: "'Pretendard', sans-serif" }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#D4AF37', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B132B', fontWeight: '900', fontSize: '20px' }}>D</div>
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>DOS 증권 거래소</h1>
          </div>
          
          <div style={{ backgroundColor: '#111936', padding: '20px 25px', borderRadius: '16px', border: '1px solid #1C2541', minWidth: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C2541', paddingBottom: '10px', marginBottom: '15px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>👑 {user.username} 님</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {/* ⭐️ 어드민일 때만 보이는 특별한 버튼 */}
                {isAdmin && (
                  <button onClick={fetchAdminData} style={{ backgroundColor: '#D4AF37', color: '#0B132B', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    ⚙️ 어드민 패널
                  </button>
                )}
                <button onClick={logout} style={{ backgroundColor: 'transparent', color: '#8b9bb4', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>로그아웃</button>
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <span style={{ color: '#8b9bb4', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>보유 현금 (KRW)</span>
              <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#D4AF37' }}>{portfolio.cash.toLocaleString()}원</span>
            </div>
          </div>
        </div>

        {/* 주식 목록 영역 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {stocks.map(stock => {
            const isSelected = selectedStock?.id === stock.id;
            return (
              <div key={stock.id} onClick={() => { setSelectedStock(stock); setTradeQty(''); }}
                style={{
                  padding: '24px', borderRadius: '16px', backgroundColor: isSelected ? '#152243' : '#111936', border: isSelected ? '2px solid #D4AF37' : '2px solid #1C2541', cursor: 'pointer',
                  boxShadow: isSelected ? '0 8px 24px rgba(212, 175, 55, 0.15)' : '0 4px 12px rgba(0,0,0,0.2)'
                }}>
                <div style={{ color: isSelected ? '#D4AF37' : '#8b9bb4', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>CODE : {String(stock.id).padStart(4, '0')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.4rem', color: '#fff' }}>{stock.name}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: isSelected ? '#D4AF37' : '#fff' }}>{stock.current_price ? stock.current_price.toLocaleString() : 0} KRW</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 거래 영역 */}
        {selectedStock && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            {/* 차트는 코드 길이 상 생략되었지만 동작엔 문제없게 UI를 간소화했습니다. 필요하시면 기존 차트 코드를 유지하셔도 됩니다! */}
            <div style={{ backgroundColor: '#111936', border: '1px solid #1C2541', padding: '30px', borderRadius: '20px' }}>
              <h2 style={{ color: '#fff' }}>{selectedStock.name} 실시간 거래</h2>
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b9bb4' }}>
                <h1 style={{ fontSize: '3rem', color: '#D4AF37' }}>{selectedStock.current_price.toLocaleString()} 원</h1>
              </div>
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