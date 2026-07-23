import os
import pymysql
from dotenv import load_dotenv

load_dotenv() # .env 금고 열기

# DB 연결
DB_HOST = "mysql-14904abe-jackson1630o-9acc.f.aivencloud.com"
DB_USER = "avnadmin"
DB_PASS = os.getenv("DB_PASS")
DB_NAME = "defaultdb"
DB_PORT = 26565

conn = pymysql.connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, database=DB_NAME)
cursor = conn.cursor()

# 🚨 주의: 기존 주식과 차트 기록, 유저 보유 주식을 모두 깨끗하게 초기화합니다!
cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
cursor.execute("TRUNCATE TABLE stocks;")
cursor.execute("TRUNCATE TABLE user_stocks;")
cursor.execute("TRUNCATE TABLE price_histories;")
cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

# 🌟 원하는 9개 주식 종목과 초기 가격 설정 (여기서 이름과 가격을 마음대로 바꾸세요!)
new_stocks = [
    ("우파루파 아이스크림", 50000),
    ("(주)용암 락스", 45000),
    ("블레이즈 막대 공장", 80000),
    ("다이아몬드 광업", 120000),
    ("네더라이트 제련소", 200000),
    ("철괴 주조 주식회사", 30000),
    ("엔더 진주 무역", 75000),
    ("크리퍼 화약", 5000),
    ("주민 마을 거래소", 15000)
]

for name, price in new_stocks:
    cursor.execute(f"INSERT INTO stocks (name, current_price) VALUES ('{name}', {price})")

conn.commit()
conn.close()
print("🎉 성공! 9개의 새로운 주식이 상장되었습니다!")