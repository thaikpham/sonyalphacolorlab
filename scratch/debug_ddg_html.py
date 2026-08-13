import re
from urllib.parse import quote, unquote
from curl_cffi import requests
from bs4 import BeautifulSoup

def search_ddg_html(query):
  url = f"https://html.duckduckgo.com/html/?q={quote(query)}"
  r = requests.get(url, impersonate="chrome120", timeout=10)
  soup = BeautifulSoup(r.text, 'html.parser')
  all_a = soup.find_all('a')
  print(f"\n--- Query: {query} (Found {len(all_a)} links) ---")
  for a in all_a:
    href = a.get('href', '')
    if '/l/?uddg=' in href:
      href = unquote(href.split('/l/?uddg=')[1].split('&')[0])
    if 'bhphotovideo.com' in href:
      print("  B&H Link:", href)
      m = re.search(r'/product/(\d{6,7})-REG', href)
      if m:
        print("   -> MATCHE ITEM ID:", m.group(1))

search_ddg_html("Sony WH-1000XM5 site:bhphotovideo.com")
search_ddg_html("Sony FE 50mm f/1.4 GM site:bhphotovideo.com")
