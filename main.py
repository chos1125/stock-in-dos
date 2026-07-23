import random
import math
import pymysql
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_HOST = "localhost"
DB_USER = "root"
DB_PASS = "1223"
DB_NAME = "stock_db"

def get_db_connection():
    return pymysql.connect(host=DB_HOST, user=DB_USER, password=DB_PASS, database=DB_NAME, cursorclass=pymysql.cursors.DictCursor)

pending_prices = {}

# --- [시세 자동 변동 스케줄러] ---
def update_stock_prices():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, current_price FROM stocks")
            stocks = cursor.fetchall()
            for stock in stocks:
                stock_id, current_price = stock['id'], stock['current_price']
                
                if stock_id in pending_prices:
                    new_price = pending_prices.pop(stock_id)
                else:
                    rate = random.uniform(0.001, 0.05) * random.choice([1, -1])
                    new_price = math.floor(current_price * (1 + rate))
                
                cursor.execute("UPDATE stocks SET current_price = %s WHERE id = %s", (new_price, stock_id))
                cursor.execute("INSERT INTO price_histories (stock_id, price) VALUES (%s, %s)", (stock_id, new_price))
            conn.commit()
    finally:
        conn.close()

scheduler = BackgroundScheduler()
scheduler.add_job(update_stock_prices, 'interval', minutes=20)
scheduler.start()

# --- [조회 API] ---
@app.get("/api/stocks")
def get_stocks():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, name, current_price FROM stocks")
            return cursor.fetchall()
    finally:
        conn.close()

@app.get("/api/stocks/{stock_id}/history")
def get_stock_history(stock_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT price, recorded_at FROM price_histories WHERE stock_id = %s AND recorded_at >= DATE_SUB(NOW(), INTERVAL 4 HOUR) ORDER BY recorded_at ASC", (stock_id,))
            return cursor.fetchall()
    finally:
        conn.close()

@app.get("/api/users/{user_id}/portfolio")
def get_portfolio(user_id: int):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT cash FROM users WHERE id = %s", (user_id,))
            user_data = cursor.fetchone()
            if not user_data:
                raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
            
            cursor.execute("""
                SELECT s.id, s.name, us.quantity 
                FROM user_stocks us
                JOIN stocks s ON us.stock_id = s.id
                WHERE us.user_id = %s AND us.quantity > 0
            """, (user_id,))
            stocks = cursor.fetchall()
            
            return {"cash": user_data['cash'], "stocks": stocks}
    finally:
        conn.close()

# --- [유저 인증 및 계정 관리 API] ---
class AuthRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/register")
def register(data: AuthRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE username = %s", (data.username,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="이미 존재하는 닉네임입니다.")
            cursor.execute("INSERT INTO users (username, password, cash) VALUES (%s, %s, 0)", (data.username, data.password))
            conn.commit()
            return {"message": "회원가입 성공!"}
    finally:
        conn.close()

@app.post("/api/auth/login")
def login(data: AuthRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, username FROM users WHERE username = %s AND password = %s", (data.username, data.password))
            user = cursor.fetchone()
            if not user:
                raise HTTPException(status_code=401, detail="닉네임이나 비밀번호가 틀렸습니다.")
            return {"user_id": user['id'], "username": user['username']}
    finally:
        conn.close()

@app.delete("/api/users/{username}")
def delete_user(username: str):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="존재하지 않는 유저입니다.")
            
            cursor.execute("DELETE FROM user_stocks WHERE user_id = %s", (user['id'],))
            cursor.execute("DELETE FROM users WHERE id = %s", (user['id'],))
            conn.commit()
            return {"message": f"{username} 계정이 완전히 초기화(삭제) 되었습니다."}
    finally:
        conn.close()

# --- [💰 매수/매도 거래 API 💰] ---
class TradeRequest(BaseModel):
    user_id: int
    stock_id: int
    quantity: int

@app.post("/api/trade/buy")
def buy_stock(data: TradeRequest):
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="1주 이상부터 매수 가능합니다.")
        
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT current_price, name FROM stocks WHERE id = %s", (data.stock_id,))
            stock = cursor.fetchone()
            if not stock:
                raise HTTPException(status_code=404, detail="주식을 찾을 수 없습니다.")

            total_price = stock['current_price'] * data.quantity

            cursor.execute("SELECT cash FROM users WHERE id = %s", (data.user_id,))
            user = cursor.fetchone()

            if user['cash'] < total_price:
                raise HTTPException(status_code=400, detail=f"보유 현금이 부족합니다. (필요: {total_price}원)")

            # 현금 차감
            cursor.execute("UPDATE users SET cash = cash - %s WHERE id = %s", (total_price, data.user_id))

            # 주식 지급
            cursor.execute("SELECT id FROM user_stocks WHERE user_id = %s AND stock_id = %s", (data.user_id, data.stock_id))
            user_stock = cursor.fetchone()
            if user_stock:
                cursor.execute("UPDATE user_stocks SET quantity = quantity + %s WHERE id = %s", (data.quantity, user_stock['id']))
            else:
                cursor.execute("INSERT INTO user_stocks (user_id, stock_id, quantity) VALUES (%s, %s, %s)", (data.user_id, data.stock_id, data.quantity))

            conn.commit()
            return {"message": f"[{stock['name']}] {data.quantity}주 매수 체결 완료!"}
    finally:
        conn.close()

@app.post("/api/trade/sell")
def sell_stock(data: TradeRequest):
    if data.quantity <= 0:
        raise HTTPException(status_code=400, detail="1주 이상부터 매도 가능합니다.")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, quantity FROM user_stocks WHERE user_id = %s AND stock_id = %s", (data.user_id, data.stock_id))
            user_stock = cursor.fetchone()

            if not user_stock or user_stock['quantity'] < data.quantity:
                raise HTTPException(status_code=400, detail="보유하신 주식 수량이 부족합니다.")

            cursor.execute("SELECT current_price, name FROM stocks WHERE id = %s", (data.stock_id,))
            stock = cursor.fetchone()

            total_price = stock['current_price'] * data.quantity

            # 현금 지급
            cursor.execute("UPDATE users SET cash = cash + %s WHERE id = %s", (total_price, data.user_id))

            # 주식 차감
            if user_stock['quantity'] == data.quantity:
                cursor.execute("DELETE FROM user_stocks WHERE id = %s", (user_stock['id'],))
            else:
                cursor.execute("UPDATE user_stocks SET quantity = quantity - %s WHERE id = %s", (data.quantity, user_stock['id']))

            conn.commit()
            return {"message": f"[{stock['name']}] {data.quantity}주 매도 체결 완료!"}
    finally:
        conn.close()

# --- [관리자 전용 API] ---
class CashChargeRequest(BaseModel):
    username: str
    amount: int

@app.post("/api/secret-admin/charge-cash")
def charge_cash(data: CashChargeRequest, x_admin_token: str = Header(None)):
    if x_admin_token != "admin1234":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE users SET cash = cash + %s WHERE username = %s", (data.amount, data.username))
            conn.commit()
            return {"message": f"{data.username}님에게 {data.amount}원이 충전되었습니다."}
    finally:
        conn.close()

class ManipulationRequest(BaseModel):
    stock_id: int
    target_price: int

@app.post("/api/secret-admin/manipulate")
def manipulate_price(data: ManipulationRequest, x_admin_token: str = Header(None)):
    if x_admin_token != "admin1234":
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    pending_prices[data.stock_id] = data.target_price
    return {"message": f"{data.stock_id}번 주식 {data.target_price}원 예약 완료."}