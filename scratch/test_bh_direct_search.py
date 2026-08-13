import re
from urllib.parse import quote
from curl_cffi import requests
from bs4 import BeautifulSoup

def search_bh_direct(query):
  url = f"https://www.bhphotovideo.com/c/search?Ntt={quote(query)}"
  print(f"Fetching B&H search: {url}")
  try:
    r = requests.get(url, impersonate="chrome120", timeout=12)
    print(f"Status Code: {r.status_code}, Length: {len(r.text)}")
    
    # Check if direct product redirect occurred
    m_redirect = re.search(r'/product/(\d{6,7})-REG', r.url)
    if m_redirect:
      print(" Direct redirect to item ID:", m_redirect.group(1))
      return m_redirect.group(1)
      
    # Search for product item IDs in search results
    item_ids = re.findall(r'/product/(\d{6,7})-REG', r.text)
    unique_ids = list(dict.fromkeys(item_ids))
    print(f" Found {len(unique_ids)} item IDs in search page:", unique_ids[:5])
    if unique_ids:
      return unique_ids[0]
  except Exception as e:
    print("Error:", e)
  return None

tests = [
  "Sony WH-1000XM5",
  "Sony FE 50mm f/1.4 GM",
  "Sony a7 IV",
  "Sony ZV-1F",
  "Sony FE 24-70mm f/2.8 GM II",
  "Sony WF-1000XM5"
]

for t in tests:
  item_id = search_bh_direct(t)
  print(f"Result for '{t}' => B&H Item ID: {item_id}\n")
