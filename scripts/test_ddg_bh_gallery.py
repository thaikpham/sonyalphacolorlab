import re
import json
import time
import random
from urllib.parse import quote
from curl_cffi import requests

def get_ddg_vqd(query):
  url = f"https://duckduckgo.com/?q={quote(query)}"
  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  }
  try:
    r = requests.get(url, headers=headers, impersonate="chrome120", timeout=10)
    m = re.search(r'vqd=["\']([^"\']+)["\']', r.text) or re.search(r'vqd=([\d-]+)', r.text)
    if m:
      return m.group(1)
  except Exception as e:
    print(f"Error getting vqd for {query}:", e)
  return None

def fetch_bh_images_via_ddg(query):
  vqd = get_ddg_vqd(query)
  if not vqd:
    return []
    
  img_url = f"https://duckduckgo.com/i.js?l=us-en&o=json&q={quote(query)}&vqd={vqd}"
  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  }
  try:
    r = requests.get(img_url, headers=headers, impersonate="chrome120", timeout=10)
    data = r.json()
    results = data.get('results', [])
    
    bh_images = []
    for item in results:
      img = item.get('image', '')
      if 'bhphoto' in img or 'bhphotovideo' in img:
        # Exclude irrelevant/tiny images
        if any(x in img for x in ['oldIEMessage', 'favicon', 'logo', 'smallimages', 'images150x150', 'images250x250', 'images345x345', 'explora']):
          continue
        # Upgrade resolution to images1000x1000
        upgraded = re.sub(r'/images\d+x\d+/', '/images1000x1000/', img)
        upgraded = re.sub(r'/images/fb/', '/images/images1000x1000/', upgraded)
        if upgraded not in bh_images:
          bh_images.append(upgraded)
    return bh_images
  except Exception as e:
    print(f"Error fetching DDG images for {query}:", e)
    return []

# Test with 5 products
tests = [
  ("Sony a7 IV", "ILCE-7M4"),
  ("Sony FX3", "ILME-FX3"),
  ("Sony FE 24-70mm f/2.8 GM II", "SEL2470GM2"),
  ("Sony WH-1000XM5", "WH-1000XM5"),
  ("Sony WF-1000XM5", "WF-1000XM5")
]

for name, sku in tests:
  q = f"Sony {name} {sku} bhphoto"
  print(f"\nQuerying: '{q}'")
  imgs = fetch_bh_images_via_ddg(q)
  print(f"Found {len(imgs)} B&H image URLs:")
  for img in imgs[:8]:
    print(" -", img)
  time.sleep(1.0)
