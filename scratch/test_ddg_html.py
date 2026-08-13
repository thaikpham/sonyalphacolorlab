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
      # Find links in search results
      links = soup.find_all('a', class_='result__url')
      for a in links:
        href = a.get('href', '')
        # Unquote DDG link wrapper
        if '/l/?uddg=' in href:
          href = unquote(href.split('/l/?uddg=')[1].split('&')[0])
        print(" Found link:", href)
        m = re.search(r'/product/(\d{6,7})-REG', href)
        if m:
          return m.group(1)
  except Exception as e:
    print("Error:", e)
  return None

item_id = search_ddg_html_bh_item("Sony a7 IV ILCE-7M4")
print("Matched Item ID:", item_id)
