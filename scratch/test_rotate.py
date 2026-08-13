import time
import random
from curl_cffi import requests

impersonates = ["chrome120", "chrome119", "chrome124", "safari15_5", "edge101"]

def test_fetch(item_id):
  imp = random.choice(impersonates)
  url = f"https://www.bhphotovideo.com/c/product/{item_id}-REG/"
  print(f"Fetching item {item_id} with {imp}...")
  r = requests.get(url, impersonate=imp, timeout=10)
  print(f"  Status: {r.status_code}, Length: {len(r.text)}")
  return r.status_code

for item_id in ['1899230', '1624226', '1729317']:
  test_fetch(item_id)
  time.sleep(3.0 + random.uniform(0.5, 1.5))
