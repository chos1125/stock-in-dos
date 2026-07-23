import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';

function App() {
  const [user, setUser] = useState(null);
  const [portfolio, setPortfolio] = useState({ cash: 0, stocks: [] });
  
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [history, setHistory] = useState([]);
  
  // 거래 수량 관리
  const [tradeQty, setTradeQty] = useState(''); 

  const handleAuth = async (type) => {
    try {
      const url = type === 'login' ? 'https://stock-in-dos.onrender.com/api/auth/login' : 'https://stock-in-dos.onrender.com/api/auth/register';
      const res = await axios.post(url, authForm);
      if (type === 'login') {
        setUser(res.data);
      } else {
        alert('계좌 개설(회원가입)이 완료되었습니다! 이제 로그인해 주세요.');
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
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("🚨 정말로 계정을 삭제하시겠습니까?\n보유 중인 캐시와 주식이 모두 영구적으로 날아갑니다.");
    if (!confirmDelete) return;
    try {
      await axios.delete(`https://stock-in-dos.onrender.com/api/users/${user.username}`);
      alert("계정이 성공적으로 초기화(삭제) 되었습니다.");
      logout();
    } catch (err) {
      alert("삭제 실패: " + (err.response?.data?.detail || "알 수 없는 오류"));
    }
  };

  // --- [매수 / 매도 실행 함수] ---
  const handleTrade = async (tradeType) => {
    const qty = Number(tradeQty);
    if (qty <= 0 || !Number.isInteger(qty)) {
      alert("정확한 수량을 입력해주세요.");
      return;
    }
    
    try {
      const endpoint = tradeType === 'buy' ? '/api/trade/buy' : '/api/trade/sell';
      const res = await axios.post(`https://stock-in-dos.onrender.com${endpoint}`, {
        user_id: user.user_id,
        stock_id: selectedStock.id,
        quantity: qty
      });
      alert(res.data.message);
      setTradeQty(''); // 거래 후 수량 입력칸 초기화
      fetchPortfolio(); // 지갑 최신화
    } catch (err) {
      alert(err.response?.data?.detail || "거래 중 오류가 발생했습니다.");
    }
  };

  const fetchStocks = async () => {
    try {
      const res = await axios.get('https://stock-in-dos.onrender.com/api/stocks');
      if (Array.isArray(res.data)) {
        setStocks(res.data);
        if (!selectedStock && res.data.length > 0) setSelectedStock(res.data[0]);
        // 선택된 주식의 실시간 가격 업데이트
        if (selectedStock) {
          const updatedSelected = res.data.find(s => s.id === selectedStock.id);
          if (updatedSelected) setSelectedStock(updatedSelected);
        }
      }
    } catch (err) {}
  };

  const fetchHistory = async (stockId) => {
    try {
      const res = await axios.get(`https://stock-in-dos.onrender.com/api/stocks/${stockId}/history`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {}
  };

  const fetchPortfolio = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`https://stock-in-dos.onrender.com/api/users/${user.user_id}/portfolio`);
      setPortfolio(res.data);
    } catch (err) {}
  };

  useEffect(() => {
    if (user) {
      fetchStocks();
      fetchPortfolio();
      const interval = setInterval(() => { fetchStocks(); fetchPortfolio(); }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    if (selectedStock) fetchHistory(selectedStock.id);
  }, [selectedStock?.id]);

  const chartSeries = [{
    name: selectedStock ? selectedStock.name : '시세',
    data: history.map(item => ({ x: new Date(item.recorded_at).getTime(), y: item.price }))
  }];

  const chartOptions = {
    chart: { type: 'area', background: 'transparent', toolbar: { show: false }, animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } } },
    theme: { mode: 'dark' },
    xaxis: { type: 'datetime', labels: { style: { colors: '#8b9bb4' } } },
    yaxis: { labels: { formatter: (val) => val ? val.toLocaleString() + '원' : '', style: { colors: '#8b9bb4' } } },
    stroke: { curve: 'smooth', width: 3, colors: ['#D4AF37'] },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, colors: ['#D4AF37'] } },
    colors: ['#D4AF37'],
    grid: { borderColor: '#1e293b', strokeDashArray: 4 }
  };

  const inputStyle = { width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #1C2541', backgroundColor: '#0B132B', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' };

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0B132B', color: '#fff', fontFamily: "'Pretendard', sans-serif" }}>
        <div style={{ backgroundColor: '#111936', padding: '50px', borderRadius: '20px', border: '1px solid #1C2541', width: '400px', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          <div style={{ width: '60px', height: '60px', backgroundColor: '#D4AF37', borderRadius: '12px', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0B132B', fontWeight: '900', fontSize: '30px' }}>D</div>
          <h2 style={{ marginBottom: '10px', color: '#fff' }}>DOS 증권 거래소</h2>
          
          {isRegisterMode ? (
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ color: '#D4AF37', marginBottom: '20px', fontSize: '1.1rem' }}>신규 계좌 개설</h3>
              <input type="text" placeholder="사용할 마인크래프트 닉네임" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} style={inputStyle} />
              <input type="password" placeholder="사용할 비밀번호" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} style={{...inputStyle, marginBottom: '30px'}} />
              <button onClick={() => handleAuth('register')} style={{ width: '100%', padding: '15px', backgroundColor: '#1C2541', color: '#fff', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>회원가입 완료</button>
              <div style={{ marginTop: '20px', color: '#8b9bb4', fontSize: '0.9rem' }}>
                이미 계좌가 있으신가요? <span onClick={() => setIsRegisterMode(false)} style={{ color: '#D4AF37', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>로그인하기</span>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '30px' }}>
               <h3 style={{ color: '#8b9bb4', marginBottom: '20px', fontSize: '1.1rem' }}>HTS 시스템 접속</h3>
              <input type="text" placeholder="마인크래프트 닉네임" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} style={inputStyle} />
              <input type="password" placeholder="비밀번호" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} style={{...inputStyle, marginBottom: '30px'}} />
              <button onClick={() => handleAuth('login')} style={{ width: '100%', padding: '15px', backgroundColor: '#D4AF37', color: '#0B132B', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>로그인</button>
              <div style={{ marginTop: '20px', color: '#8b9bb4', fontSize: '0.9rem' }}>
                아직 계좌가 없으신가요? <span onClick={() => setIsRegisterMode(true)} style={{ color: '#D4AF37', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}>계좌 개설하기</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 현재 선택된 주식의 내 보유 수량 계산
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
          
          <div style={{ backgroundColor: '#111936', padding: '20px 25px', borderRadius: '16px', border: '1px solid #1C2541', minWidth: '250px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1C2541', paddingBottom: '10px', marginBottom: '15px' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff' }}>👑 {user.username} 님</span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={logout} style={{ backgroundColor: 'transparent', color: '#8b9bb4', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>로그아웃</button>
                <button onClick={handleDeleteAccount} style={{ backgroundColor: 'transparent', color: '#ff4d4f', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>계정 초기화</button>
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <span style={{ color: '#8b9bb4', fontSize: '0.9rem', display: 'block', marginBottom: '5px' }}>보유 현금 (KRW)</span>
              <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#D4AF37' }}>{portfolio.cash.toLocaleString()}원</span>
            </div>
            <div>
              <span style={{ color: '#8b9bb4', fontSize: '0.9rem', display: 'block', marginBottom: '8px' }}>보유 주식 내역</span>
              {portfolio.stocks.length === 0 ? (
                <div style={{ color: '#5a6b8a', fontSize: '0.9rem' }}>보유중인 주식이 없습니다.</div>
              ) : (
                portfolio.stocks.map((s, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.95rem' }}>
                    <span style={{ color: '#fff' }}>{s.name}</span>
                    <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>{s.quantity}주</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
          {stocks.map(stock => {
            const isSelected = selectedStock?.id === stock.id;
            return (
              <div
                key={stock.id}
                onClick={() => { setSelectedStock(stock); setTradeQty(''); }}
                style={{
                  padding: '24px', borderRadius: '16px',
                  backgroundColor: isSelected ? '#152243' : '#111936',
                  border: isSelected ? '2px solid #D4AF37' : '2px solid #1C2541',
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 8px 24px rgba(212, 175, 55, 0.15)' : '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ color: isSelected ? '#D4AF37' : '#8b9bb4', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>CODE : {String(stock.id).padStart(4, '0')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.4rem', color: '#fff' }}>{stock.name}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: isSelected ? '#D4AF37' : '#fff' }}>
                    {stock.current_price ? stock.current_price.toLocaleString() : 0}<span style={{ fontSize: '1rem', marginLeft: '2px', fontWeight: 'normal' }}>KRW</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedStock && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
            {/* 차트 영역 */}
            <div style={{ backgroundColor: '#111936', border: '1px solid #1C2541', padding: '30px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div><h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#fff' }}>{selectedStock.name} 차트</h2></div>
                <div style={{ textAlign: 'right' }}><h2 style={{ margin: 0, color: '#D4AF37', fontSize: '2rem' }}>{selectedStock.current_price ? selectedStock.current_price.toLocaleString() : 0}원</h2></div>
              </div>
              <Chart options={chartOptions} series={chartSeries} type="area" height={400} />
            </div>

            {/* 거래 주문 영역 */}
            <div style={{ backgroundColor: '#111936', border: '1px solid #1C2541', padding: '30px', borderRadius: '20px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '1.3rem', borderBottom: '1px solid #1C2541', paddingBottom: '15px' }}>주문 패널</h2>
              
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', color: '#8b9bb4', fontSize: '0.95rem' }}>
                <span>현재 보유 수량:</span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>{myQty}주</span>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                  <button onClick={() => setTradeQty(Math.floor(portfolio.cash / selectedStock.current_price))} style={{ flex: 1, padding: '8px', backgroundColor: '#1C2541', border: 'none', color: '#8b9bb4', borderRadius: '6px', cursor: 'pointer' }}>최대 매수</button>
                  <button onClick={() => setTradeQty(myQty)} style={{ flex: 1, padding: '8px', backgroundColor: '#1C2541', border: 'none', color: '#8b9bb4', borderRadius: '6px', cursor: 'pointer' }}>전량 매도</button>
                </div>
                <input 
                  type="number" 
                  placeholder="수량 (주)" 
                  value={tradeQty} 
                  onChange={e => setTradeQty(e.target.value)} 
                  style={{ width: '100%', padding: '15px', borderRadius: '8px', border: '1px solid #1C2541', backgroundColor: '#0B132B', color: '#fff', fontSize: '1.2rem', textAlign: 'right', boxSizing: 'border-box' }} 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', backgroundColor: '#0B132B', padding: '15px', borderRadius: '8px' }}>
                <span style={{ color: '#8b9bb4' }}>총 결제 금액</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' }}>{totalPrice.toLocaleString()} 원</span>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                <button onClick={() => handleTrade('buy')} style={{ flex: 1, padding: '18px', backgroundColor: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(255, 77, 79, 0.3)' }}>매 수</button>
                <button onClick={() => handleTrade('sell')} style={{ flex: 1, padding: '18px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)' }}>매 도</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;