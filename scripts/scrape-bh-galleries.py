import os
import re
import json
import time
import random
from urllib.parse import quote
from curl_cffi import requests
from bs4 import BeautifulSoup

CAMERAS_SEED = "data/sony-cameras.seed.json"
AUDIO_SEED = "data/sony-audio.seed.json"

def clean_sku(sku):
  if not sku:
    return ""
  base = sku.split('/')[0].split('+')[0].strip()
  base = re.sub(r'\s+[A-Z0-9]{2,4}$', '', base)
  return base.strip()

def request_with_retry(url, retries=3):
  """Fetch URL using curl_cffi with retries and exponential backoff on 429/errors."""
  for attempt in range(retries):
    try:
      r = requests.get(url, impersonate="chrome120", timeout=12)
      if r.status_code == 200 and "Just a moment..." not in r.text:
        return r
      if r.status_code == 429:
        wait_time = (attempt + 1) * 3 + random.uniform(1, 3)
        print(f"    [429 Rate Limit] Sleeping {wait_time:.1f}s before retry {attempt+1}/{retries}...")
        time.sleep(wait_time)
      else:
        time.sleep(1.5)
    except Exception as e:
      print(f"    [Request Exception] {url}: {e}")
      time.sleep(2)
  return None

def search_bh_item(query):
  """Search B&H directly using curl_cffi search endpoint with retry."""
  url = f"https://www.bhphotovideo.com/c/search?Ntt={quote(query)}"
  r = request_with_retry(url)
  if not r:
    return None
    
  m_redirect = re.search(r'/product/(\d{6,7})-REG', r.url)
  if m_redirect:
    return m_redirect.group(1)
    
  item_ids = re.findall(r'/product/(\d{6,7})-REG', r.text)
  unique_ids = list(dict.fromkeys(item_ids))
  if unique_ids:
    return unique_ids[0]
  return None

def fetch_bh_product(item_id):
  """Fetch B&H product page with retry and extract primary image + galleryUrls."""
  url = f"https://www.bhphotovideo.com/c/product/{item_id}-REG/"
  r = request_with_retry(url)
  if not r:
    return None, [], ""

  try:
    soup = BeautifulSoup(r.text, 'html.parser')
    page_title = soup.title.string.strip() if soup.title else ""
    
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

    primary_img = main_candidates[0] if main_candidates else (upgraded[0] if upgraded else None)
    gallery_set = list(dict.fromkeys(main_candidates + multi_candidates))

    return primary_img, gallery_set, page_title
  except Exception as e:
    return None, [], ""

def process_catalog(filepath, catalog_name):
  print(f"\n=========================================")
  print(f" Processing {catalog_name} ({filepath})")
  print(f"=========================================")
  
  with open(filepath, "r", encoding="utf-8") as f:
    products = json.load(f)
    
  updated_count = 0
  gallery_count_total = 0
  
  for idx, p in enumerate(products):
    # Skip if product already has valid galleryUrls with >= 2 images
    if p.get('galleryUrls') and len(p.get('galleryUrls')) >= 2 and p.get('imageUrl'):
      print(f"[{idx+1}/{len(products)}] Product: {p.get('name')} | Already has {len(p['galleryUrls'])} gallery images. Skipping.")
      updated_count += 1
      gallery_count_total += len(p['galleryUrls'])
      continue

    p_id = p.get('id', '')
    p_name = p.get('name', '')
    p_fullName = p.get('fullName', '')
    p_sku = p.get('sku', '')
    c_sku = clean_sku(p_sku)
    existing_img = p.get('imageUrl', '')
    
    print(f"\n[{idx+1}/{len(products)}] Product: {p_name} | SKU: {p_sku} ({c_sku})")
    
    item_id = None
    if existing_img:
      m = re.search(r'_(\d{6,7})\.jpg', existing_img) or re.search(r'IMG_(\d{6,7})\.jpg', existing_img)
      if m:
        item_id = m.group(1)
        
    if not item_id:
      query_terms = [f"Sony {p_name} {c_sku}".strip()]
      if c_sku and c_sku != p_name:
        query_terms.append(f"Sony {c_sku}".strip())
      if p_name:
        query_terms.append(f"Sony {p_name}".strip())
      if p_fullName:
        query_terms.append(p_fullName.strip())

      for q in query_terms:
        print(f"  Searching B&H: '{q}'")
        item_id = search_bh_item(q)
        if item_id:
          break
        time.sleep(1.0)
        
    if item_id:
      print(f"  Matched B&H Item ID: {item_id}")
      primary, gallery, title = fetch_bh_product(item_id)
      if primary and gallery:
        print(f"  [SUCCESS] Title: {title[:60]}")
        print(f"  [SUCCESS] Primary: {primary.split('/')[-1]}")
        print(f"  [SUCCESS] Gallery: {len(gallery)} images")
        p['imageUrl'] = primary
        p['galleryUrls'] = gallery
        if not p.get('url'):
          p['url'] = f"https://www.bhphotovideo.com/c/product/{item_id}-REG/"
        updated_count += 1
        gallery_count_total += len(gallery)
        
        # Save incrementally after each item!
        with open(filepath, "w", encoding="utf-8") as f_out:
          json.dump(products, f_out, ensure_ascii=False, indent=2)
      else:
        print(f"  [WARN] Failed to fetch product page or gallery for item {item_id}")
    else:
      print(f"  [WARN] Could not find B&H Item ID for '{p_name}'")
      
    time.sleep(1.2 + random.uniform(0.2, 0.8))
    
  print(f"\nFINISHED {catalog_name}: {updated_count}/{len(products)} products updated, total {gallery_count_total} gallery images added.")

if __name__ == "__main__":
  process_catalog(CAMERAS_SEED, "Sony Cameras & Lenses Catalog")
  process_catalog(AUDIO_SEED, "Sony Audio Products Catalog")
