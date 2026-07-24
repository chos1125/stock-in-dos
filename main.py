import random
import math
import pymysql
import os
import time
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_HOST = "mysql-14904abe-jackson1630o-9acc.f.aivencloud.com"
DB_USER = "avnadmin"
DB_PASS = os.getenv("DB_PASS")
DB_NAME = "defaultdb"
DB_PORT = 26565

def get_db_connection():
    return pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME, cursorclass=pymysql.cursors.DictCursor)

NEXT_UPDATE_TIME = time.time() + (25 * 60)
manipulated_targets = {}

@app.get("/api/timer")
def get_time_left():
    left = int(NEXT_UPDATE_TIME - time.time())
    return {"time_left": max(0, left)}

class AuthForm(BaseModel):
    username: str
    password: str

class TradeRequest(BaseModel):
    user_id: int
    stock_id: int
    quantity: int

class BankReq(BaseModel):
    username: str
    req_type: str
    amount: int

class BankProcess(BaseModel):
    admin_name: str
    req_id: int
    action: str

class ManipulateReq(BaseModel):
    admin_name: str
    stock_id: int
    new_price: int

@app.post("/api/auth/register")
def register(form: AuthForm):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username=%s", (form.username,))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")
    cursor.execute("INSERT INTO users (username, password, cash) VALUES (%s, %s, 100000)", (form.username, form.password))
    conn.commit()
    conn.close()
    return {"message": "회원가입 성공"}

@app.post("/api/auth/login")
def login(form: AuthForm):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username FROM users WHERE username=%s AND password=%s", (form.username, form.password))
    user = cursor.fetchone()
    conn.close()
    if not user:
        raise HTTPException(status_code=400, detail="닉네임이나 비밀번호가 틀렸습니다.")
    return {"user_id": user['id'], "username": user['username']}

@app.get("/api/stocks")
def get_stocks():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM stocks")
    stocks = cursor.fetchall()
    conn.close()
    return stocks

@app.get("/api/stocks/{stock_id}/history")
def get_stock_history(stock_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT price, recorded_at FROM price_histories WHERE stock_id=%s ORDER BY recorded_at ASC", (stock_id,))
    history = cursor.fetchall()
    conn.close()
    return history

@app.get("/api/users/{user_id}/portfolio")
def get_portfolio(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT cash FROM users WHERE id=%s", (user_id,))
    user = cursor.fetchone()
    
    cursor.execute("""
        SELECT s.id, s.name, us.quantity, s.current_price, us.average_price
        FROM user_stocks us
        JOIN stocks s ON us.stock_id = s.id
        WHERE us.user_id=%s AND us.quantity > 0
    """, (user_id,))
    stocks = cursor.fetchall()
    conn.close()
    
    portfolio_stocks = []
    for st in stocks:
        avg_price = st['average_price'] or 0
        curr_price = st['current_price']
        rtn_rate = 0
        if avg_price > 0:
            rtn_rate = ((curr_price - avg_price) / avg_price) * 100
            
        portfolio_stocks.append({
            "id": st['id'],
            "name": st['name'],
            "quantity": st['quantity'],
            "current_price": curr_price,
            "average_price": avg_price,
            "return_rate": round(rtn_rate, 2)
        })
        
    return {"cash": user['cash'], "stocks": portfolio_stocks}

@app.post("/api/trade/buy")
def buy_stock(req: TradeRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT cash FROM users WHERE id=%s", (req.user_id,))
    user = cursor.fetchone()
    cursor.execute("SELECT current_price FROM stocks WHERE id=%s", (req.stock_id,))
    stock = cursor.fetchone()
    
    total_price = stock['current_price'] * req.quantity
    if user['cash'] < total_price:
        raise HTTPException(status_code=400, detail="잔액이 부족합니다.")
        
    cursor.execute("UPDATE users SET cash = cash - %s WHERE id=%s", (total_price, req.user_id))
    
    cursor.execute("SELECT quantity, average_price FROM user_stocks WHERE user_id=%s AND stock_id=%s", (req.user_id, req.stock_id))
    user_stock = cursor.fetchone()
    
    if user_stock:
        old_qty = user_stock['quantity']
        old_avg = user_stock['average_price'] or 0
        new_qty = old_qty + req.quantity
        new_avg = ((old_qty * old_avg) + total_price) / new_qty
        cursor.execute("UPDATE user_stocks SET quantity=%s, average_price=%s WHERE user_id=%s AND stock_id=%s", (new_qty, new_avg, req.user_id, req.stock_id))
    else:
        cursor.execute("INSERT INTO user_stocks (user_id, stock_id, quantity, average_price) VALUES (%s, %s, %s, %s)", (req.user_id, req.stock_id, req.quantity, stock['current_price']))
        
    conn.commit()
    conn.close()
    return {"message": f"매수 완료! (-{total_price}원)"}

@app.post("/api/trade/sell")
def sell_stock(req: TradeRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT quantity FROM user_stocks WHERE user_id=%s AND stock_id=%s", (req.user_id, req.stock_id))
    user_stock = cursor.fetchone()
    
    if not user_stock or user_stock['quantity'] < req.quantity:
        raise HTTPException(status_code=400, detail="보유 주식이 부족합니다.")
        
    cursor.execute("SELECT current_price FROM stocks WHERE id=%s", (req.stock_id,))
    stock = cursor.fetchone()
    total_price = stock['current_price'] * req.quantity
    
    cursor.execute("UPDATE users SET cash = cash + %s WHERE id=%s", (total_price, req.user_id))
    cursor.execute("UPDATE user_stocks SET quantity = quantity - %s WHERE user_id=%s AND stock_id=%s", (req.quantity, req.user_id, req.stock_id))
    
    conn.commit()
    conn.close()
    return {"message": f"매도 완료! (+{total_price}원)"}

ADMINS = ["ch__os", "CIDER22", "Zzzxvr"]

@app.get("/api/admin/dashboard")
def get_admin_dashboard(username: str):
    if username not in ADMINS:
        raise HTTPException(status_code=403, detail="권한 없음")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, cash FROM users")
    users = cursor.fetchall()
    
    cursor.execute("SELECT us.user_id, s.name, us.quantity, s.current_price, us.average_price FROM user_stocks us JOIN stocks s ON us.stock_id = s.id WHERE us.quantity > 0")
    stocks_data = cursor.fetchall()
    conn.close()
    
    user_dict = {u['id']: {"username": u['username'], "cash": u['cash'], "total_stock_value": 0, "total_invested": 0, "holdings": []} for u in users}
    
    for st in stocks_data:
        uid = st['user_id']
        if uid in user_dict:
            val = st['quantity'] * st['current_price']
            invested = st['quantity'] * (st['average_price'] or 0)
            user_dict[uid]['total_stock_value'] += val
            user_dict[uid]['total_invested'] += invested
            user_dict[uid]['holdings'].append(f"{st['name']} {st['quantity']}주")
            
    result = []
    for uid, data in user_dict.items():
        data['total_assets'] = data['cash'] + data['total_stock_value']
        profit = data['total_stock_value'] - data['total_invested']
        data['return_rate'] = round((profit / data['total_invested']) * 100, 2) if data['total_invested'] > 0 else 0.0
        result.append(data)
        
    result.sort(key=lambda x: x['total_assets'], reverse=True)
    return result

@app.post("/api/bank/request")
def request_bank(req: BankReq):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO bank_requests (username, req_type, amount) VALUES (%s, %s, %s)", (req.username, req.req_type, req.amount))
    conn.commit()
    conn.close()
    return {"message": f"[{req.req_type}] {req.amount}원 신청 완료!"}

@app.get("/api/admin/bank")
def get_bank_requests(username: str):
    if username not in ADMINS:
        raise HTTPException(status_code=403, detail="권한 없음")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bank_requests WHERE status='대기중' ORDER BY created_at ASC")
    reqs = cursor.fetchall()
    conn.close()
    return reqs

@app.post("/api/admin/bank/process")
def process_bank(req: BankProcess):
    if req.admin_name not in ADMINS:
        raise HTTPException(status_code=403, detail="권한 없음")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM bank_requests WHERE id=%s", (req.req_id,))
    bank_req = cursor.fetchone()
    if not bank_req or bank_req['status'] != '대기중':
        conn.close()
        raise HTTPException(status_code=400, detail="이미 처리된 요청입니다.")
        
    if req.action == '승인':
        cursor.execute("SELECT id, cash FROM users WHERE username=%s", (bank_req['username'],))
        t_user = cursor.fetchone()
        if t_user:
            if bank_req['req_type'] == '입금':
                cursor.execute("UPDATE users SET cash = cash + %s WHERE id=%s", (bank_req['amount'], t_user['id']))
            else:
                if t_user['cash'] < bank_req['amount']:
                    conn.close()
                    raise HTTPException(status_code=400, detail="유저 잔액 부족으로 출금 불가")
                cursor.execute("UPDATE users SET cash = cash - %s WHERE id=%s", (bank_req['amount'], t_user['id']))
        cursor.execute("UPDATE bank_requests SET status='승인' WHERE id=%s", (req.req_id,))
    else:
        cursor.execute("UPDATE bank_requests SET status='거절' WHERE id=%s", (req.req_id,))
        
    conn.commit()
    conn.close()
    return {"message": "처리 완료"}

@app.post("/api/admin/manipulate")
def manipulate_stock(req: ManipulateReq):
    global manipulated_targets
    if req.admin_name not in ADMINS:
        raise HTTPException(status_code=403, detail="권한 없음")
    
    manipulated_targets[req.stock_id] = req.new_price
    return {"message": f"주가 조작 예약 완료! (다음 변동 시간에 적용됩니다 ⚡)"}

# ⭐️ 0.5% 단위로 상승/하락하게 로직 수정!
def update_stock_prices():
    global NEXT_UPDATE_TIME, manipulated_targets
    NEXT_UPDATE_TIME = time.time() + (25 * 60)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, current_price FROM stocks")
    stocks = cursor.fetchall()
    
    # -10부터 10까지의 숫자 중 0을 제외한 리스트를 만듭니다. (무조건 오르거나 내리게 하기 위함)
    multipliers = [i for i in range(-10, 11) if i != 0]
    
    for stock in stocks:
        stock_id = stock['id']
        
        if stock_id in manipulated_targets:
            new_price = manipulated_targets.pop(stock_id) 
        else:
            # 리스트에서 숫자 하나를 뽑아 0.005(0.5%)를 곱합니다.
            # 예: 3이 뽑히면 3 * 0.005 = 0.015 (1.5%) 상승!
            chosen_multiplier = random.choice(multipliers)
            change_percent = chosen_multiplier * 0.005
            
            new_price = math.floor(stock['current_price'] * (1 + change_percent))
            new_price = max(100, new_price)
            
        cursor.execute("UPDATE stocks SET current_price=%s WHERE id=%s", (new_price, stock_id))
        cursor.execute("INSERT INTO price_histories (stock_id, price) VALUES (%s, %s)", (stock_id, new_price))
        
    conn.commit()
    conn.close()

scheduler = BackgroundScheduler()
scheduler.add_job(update_stock_prices, 'interval', minutes=25) 
scheduler.start()