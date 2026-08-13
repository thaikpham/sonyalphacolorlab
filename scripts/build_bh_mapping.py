import json
import re
import time
import random
from urllib.parse import quote
from curl_cffi import requests

CAMERAS_SEED = "data/sony-cameras.seed.json"
AUDIO_SEED = "data/sony-audio.seed.json"

impersonates = ["chrome120", "chrome119", "chrome124", "safari15_5", "edge101"]

def get_bh_item_id_from_url(url_str):
  if not url_str:
    return None
  m = re.search(r'_(\d{6,7})\.jpg', url_str) or re.search(r'IMG_(\d{6,7})\.jpg', url_str) or re.search(r'/product/(\d{6,7})-REG', url_str)
  return m.group(1) if m else None

def clean_sku(sku):
  if not sku:
    return ""
  base = sku.split('/')[0].split('+')[0].strip()
  base = re.sub(r'\s+[A-Z0-9]{2,4}$', '', base)
  return base.strip()

def search_bh(query):
  url = f"https://www.bhphotovideo.com/c/search?Ntt={quote(query)}"
  imp = random.choice(impersonates)
  try:
    r = requests.get(url, impersonate=imp, timeout=12)
    if r.status_code == 200:
      m_red = re.search(r'/product/(\d{6,7})-REG', r.url)
      if m_red:
        return m_red.group(1)
      item_ids = re.findall(r'/product/(\d{6,7})-REG', r.text)
      unique_ids = list(dict.fromkeys(item_ids))
      if unique_ids:
        return unique_ids[0]
  except Exception as e:
    pass
  return None

def build_mapping():
  with open(CAMERAS_SEED, "r", encoding="utf-8") as f:
    cameras = json.load(f)
  with open(AUDIO_SEED, "r", encoding="utf-8") as f:
    audio = json.load(f)

  mapping = {}

  all_prods = [('camera', c) for c in cameras] + [('audio', a) for a in audio]

  print(f"Total products to map: {len(all_prods)}")

  for idx, (kind, p) in enumerate(all_prods):
    p_id = p['id']
    p_name = p['name']
    p_sku = p.get('sku', '')
    c_sku = clean_sku(p_sku)
    existing_img = p.get('imageUrl', '')
    existing_url = p.get('url', '')

    item_id = get_bh_item_id_from_url(existing_img) or get_bh_item_id_from_url(existing_url)

    if not item_id:
      query = f"Sony {p_name} {c_sku}".strip()
      item_id = search_bh(query)
      if not item_id and c_sku:
        item_id = search_bh(f"Sony {c_sku}")
      if not item_id and p_name:
        item_id = search_bh(f"Sony {p_name}")
      time.sleep(2.0 + random.uniform(0.5, 1.5))

    mapping[p_id] = {
      "kind": kind,
      "name": p_name,
      "sku": p_sku,
      "itemId": item_id
    }
    print(f"[{idx+1}/{len(all_prods)}] {p_name} ({p_id}) => Item ID: {item_id}")

  with open("scratch/bh_mapping.json", "w", encoding="utf-8") as f_out:
    json.dump(mapping, f_out, indent=2)

  mapped_count = sum(1 for v in mapping.values() if v['itemId'])
  print(f"\nMapping complete: {mapped_count} / {len(all_prods)} mapped.")

if __name__ == "__main__":
  build_mapping()
