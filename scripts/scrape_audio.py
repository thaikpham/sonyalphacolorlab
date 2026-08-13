import json
import re
import time
import random
from urllib.parse import quote
from curl_cffi import requests
from bs4 import BeautifulSoup

AUDIO_SEED = "data/sony-audio.seed.json"
impersonates = ["chrome120", "chrome119", "chrome124", "safari15_5", "edge101"]

def get_bh_page(url):
  imp = random.choice(impersonates)
  headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  }
  for attempt in range(3):
    try:
      r = requests.get(url, headers=headers, impersonate=imp, timeout=12)
      if r.status_code == 200 and "Just a moment..." not in r.text:
        return r
      time.sleep(2.0 + attempt * 2)
    except Exception:
      time.sleep(2.0)
  return None

def search_bh_audio_item(query):
  url = f"https://www.bhphotovideo.com/c/search?Ntt={quote(query)}"
  r = get_bh_page(url)
  if not r:
    return None
  m_redirect = re.search(r'/product/(\d{6,7})-REG', r.url)
  if m_redirect:
    return m_redirect.group(1)
  item_ids = re.findall(r'/product/(\d{6,7})-REG', r.text)
  unique_ids = list(dict.fromkeys(item_ids))
  return unique_ids[0] if unique_ids else None

def extract_bh_gallery(item_id):
  url = f"https://www.bhphotovideo.com/c/product/{item_id}-REG/"
  r = get_bh_page(url)
  if not r:
    return None, []
  
  all_imgs = re.findall(r'https?:\\?/\\?/(?:static\.bhphoto\.com|www\.bhphotovideo\.com)\\?/images\\?/[^\s"\'\\><]+?\.(?:jpg|png|webp)', r.text)
  clean_imgs = list(set([img.replace('\\', '') for img in all_imgs]))
  
  upgraded = []
  for img in clean_imgs:
    if any(x in img for x in ['oldIEMessage', 'favicon', 'logo', 'smallimages', 'images150x150', 'images250x250', 'images345x345']):
      continue
    res_img = re.sub(r'/images\d+x\d+/', '/images1000x1000/', img)
    if res_img not in upgraded:
      upgraded.append(res_img)

  main_candidates = [i for i in upgraded if 'multiple_images' not in i]
  multi_candidates = [i for i in upgraded if 'multiple_images' in i]

  primary_img = main_candidates[0] if main_candidates else (upgraded[0] if upgraded else f"https://static.bhphoto.com/images/fb/{item_id}.jpg")
  gallery = list(dict.fromkeys(main_candidates + multi_candidates))
  if not gallery:
    gallery = [primary_img]

  return primary_img, gallery

def main():
  with open(AUDIO_SEED, "r", encoding="utf-8") as f:
    products = json.load(f)

  print(f"Processing {len(products)} audio products...")

  for idx, p in enumerate(products):
    name = p['name']
    fullName = p.get('fullName', '')
    
    # Custom search query for audio models
    search_queries = [
      f"Sony {name}".strip(),
      f"Sony {fullName}".split('(')[0].strip()
    ]

    item_id = None
    for q in search_queries:
      print(f"[{idx+1}/{len(products)}] Searching B&H for '{q}'...")
      item_id = search_bh_audio_item(q)
      if item_id:
        break
      time.sleep(2.0)

    if item_id:
      print(f"  -> Found B&H Item ID: {item_id}")
      primary, gallery = extract_bh_gallery(item_id)
      print(f"  -> Primary: {primary}")
      print(f"  -> Gallery: {len(gallery)} images")
      p['imageUrl'] = primary
      p['galleryUrls'] = gallery
      p['url'] = f"https://www.bhphotovideo.com/c/product/{item_id}-REG/"
    else:
      print(f"  -> [WARN] No B&H Item ID found for {name}")

    with open(AUDIO_SEED, "w", encoding="utf-8") as f_out:
      json.dump(products, f_out, ensure_ascii=False, indent=2)

    time.sleep(2.5 + random.uniform(0.5, 1.5))

  print("Completed audio catalog scraping!")

if __name__ == "__main__":
  main()
