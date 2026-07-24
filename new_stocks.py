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

cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
cursor.execute("TRUNCATE TABLE stocks;")
cursor.execute("TRUNCATE TABLE user_stocks;")
cursor.execute("TRUNCATE TABLE price_histories;")
cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

# ⭐️ 요청하신 9개 테마 종목! (초기 가격은 임의로 설정해두었습니다)
new_stocks = [
    ("피글린 무역", 50000),
    ("좀비 제약", 45000),
    ("주민 은행", 80000),
    ("스티브 푸드", 120000),
    ("블레이즈 항공", 200000),
    ("가스트 운송", 30000),
    ("크리퍼 건설", 75000),
    ("엔더 네트워크", 5000),
    ("발광 오징어 에너지", 15000)
]

for name, price in new_stocks:
    cursor.execute(f"INSERT INTO stocks (name, current_price) VALUES ('{name}', {price})")

conn.commit()
conn.close()
print("🎉 9개 새로운 주식 상장 완료!")