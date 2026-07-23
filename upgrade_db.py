import os
import pymysql
from dotenv import load_dotenv

load_dotenv()

DB_HOST = "mysql-14904abe-jackson1630o-9acc.f.aivencloud.com"
DB_USER = "avnadmin"
DB_PASS = os.getenv("DB_PASS")
DB_NAME = "defaultdb"
DB_PORT = 26565

conn = pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME)
cursor = conn.cursor()

# 1. 주식 평단가 컬럼 추가 (수익률 계산용)
try:
    cursor.execute("ALTER TABLE user_stocks ADD COLUMN average_price DOUBLE DEFAULT 0;")
    print("✅ 평단가 컬럼 추가 완료")
except:
    print("⚡ 평단가 컬럼이 이미 존재합니다.")

# 2. 입출금 요청 테이블 생성
cursor.execute("""
CREATE TABLE IF NOT EXISTS bank_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50),
    req_type VARCHAR(20),
    amount INT,
    status VARCHAR(20) DEFAULT '대기중',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")
print("✅ 입출금 테이블 세팅 완료")

conn.commit()
conn.close()
print("🎉 DB 업그레이드 대성공!")