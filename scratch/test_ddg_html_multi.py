import re
from urllib.parse import quote, unquote
from curl_cffi import requests
from bs4 import BeautifulSoup

def search_ddg_html_bh_item(query):
  url = f"https://html.duckduckgo.com/html/?q={quote(query + ' site:bhphotovideo.com/c/product/')}"
  try:
    r = requests.get(url, impersonate="chrome120", timeout=10)
    if r.status_code == 200:
      soup = BeautifulSoup(r.text, 'html.parser')
      links = soup.find_all('a', class_='result__url')
      for a in links:
        href = a.get('href', '').strip()
        if '/l/?uddg=' in href:
          href = unquote(href.split('/l/?uddg=')[1].split('&')[0])
        m = re.search(r'/product/(\d{6,7})-REG', href)
        if m:
          return m.group(1), href
  except Exception as e:
    print("Error:", e)
  return None, None

tests = [
  "Sony FE 50mm f/1.4 GM SEL50F14GM",
  "Sony WH-1000XM5",
  "Sony WF-1000XM5",
  "Sony ZV-1F ZV-1F/WQ",
  "Sony FE 24-70mm f/2.8 GM II"
]

for t in tests:
  item_id, link = search_ddg_html_bh_item(t)
  print(f"Query: '{t}' => Item ID: {item_id} | Link: {link}")
