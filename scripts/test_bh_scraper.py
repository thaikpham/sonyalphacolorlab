import re
import json
import time
from urllib.parse import quote
from curl_cffi import requests
from bs4 import BeautifulSoup

def search_ddg_bh_item(query):
  """Search DuckDuckGo for B&H product link/images and return B&H item ID or product URL."""
  search_url = f"https://duckduckgo.com/?q={quote(query + ' site:bhphotovideo.com/c/product/')}"
  try:
    r = requests.get(search_url, impersonate="chrome120", timeout=10)
    vqd_match = re.search(r'vqd=["\']([^"\']+)["\']', r.text) or re.search(r'vqd=([\d-]+)', r.text)
    if not vqd_match:
      return None
    vqd = vqd_match.group(1)
    
    img_url = f"https://duckduckgo.com/i.js?l=us-en&o=json&q={quote(query + ' site:bhphotovideo.com/c/product/')}&vqd={vqd}"
    r_img = requests.get(img_url, impersonate="chrome120", timeout=10)
    data = r_img.json()
    
    for item in data.get('results', []):
      img = item.get('image', '')
      # Extract item ID from B&H image URL
      m = re.search(r'_(\d{6,7})\.jpg', img) or re.search(r'IMG_(\d{6,7})\.jpg', img)
      if m:
        return m.group(1)
      # Check page URL
      url = item.get('url', '')
      m2 = re.search(r'/product/(\d{6,7})-REG', url)
      if m2:
        return m2.group(1)
  except Exception as e:
    print(f"  [DDG Error] {query}: {e}")
  return None

def fetch_bh_gallery(item_id_or_url):
  """Fetch B&H product page using curl_cffi and return primary image + galleryUrls."""
  if item_id_or_url.startswith("http"):
    url = item_id_or_url
  else:
    url = f"https://www.bhphotovideo.com/c/product/{item_id_or_url}-REG/"

  try:
    r = requests.get(url, impersonate="chrome120", timeout=12)
    if r.status_code != 200 or "Just a moment..." in r.text:
      print(f"  [Fetch Failed] Status {r.status_code} for {url}")
      return None, []
    
    # Parse all static B&H image URLs
    all_imgs = re.findall(r'https?:\\?/\\?/(?:static\.bhphoto\.com|www\.bhphotovideo\.com)\\?/images\\?/[^\s"\'\\><]+?\.(?:jpg|png|webp)', r.text)
    clean_imgs = list(set([img.replace('\\', '') for img in all_imgs]))
    
    # Separate into primary and gallery
    primary_img = None
    gallery_set = []

    # Upgrade to 1000x1000 resolution
    upgraded = []
    for img in clean_imgs:
      # Exclude icons/logos/oldIEMessage
      if any(x in img for x in ['oldIEMessage', 'favicon', 'logo', 'smallimages', 'images150x150', 'images250x250', 'images345x345']):
        continue
      
      # Convert images500x500 or images1500x1500 or images2000x2000 to images1000x1000 for standard sizing
      res_img = re.sub(r'/images\d+x\d+/', '/images1000x1000/', img)
      if res_img not in upgraded:
        upgraded.append(res_img)
    
    # Pick primary image (usually matches main item ID and NOT multiple_images)
    main_candidates = [i for i in upgraded if 'multiple_images' not in i]
    multi_candidates = [i for i in upgraded if 'multiple_images' in i]

    if main_candidates:
      primary_img = main_candidates[0]
    elif upgraded:
      primary_img = upgraded[0]

    gallery_set = list(dict.fromkeys(main_candidates + multi_candidates))

    return primary_img, gallery_set
  except Exception as e:
    print(f"  [Fetch Exception] {url}: {e}")
    return None, []

# Test with 3 cameras & 2 audio products
test_products = [
  {"name": "Sony a7 IV", "sku": "ILCE-7M4/BQ AP2", "existing_img": "https://sony.scene7.com/is/image/sonyglobalsolutions/og?$primaryshotPreset$&fmt=png-alpha"},
  {"name": "Sony FX3", "sku": "ILME-FX3A/Q AP2", "existing_img": "https://static.bhphoto.com/images/images1000x1000/1614080143_1624226.jpg"},
  {"name": "Sony FE 24-70mm f/2.8 GM II", "sku": "SEL2470GM2", "existing_img": ""},
  {"name": "Sony WH-1000XM5", "sku": "WH-1000XM5", "existing_img": ""},
  {"name": "Sony ULT WEAR", "sku": "WH-ULT900N", "existing_img": ""}
]

for p in test_products:
  print(f"\nTesting product: {p['name']} ({p['sku']})")
  # Extract item ID from existing image if available
  m = re.search(r'_(\d{6,7})\.jpg', p['existing_img']) or re.search(r'IMG_(\d{6,7})\.jpg', p['existing_img'])
  item_id = m.group(1) if m else None

  if not item_id:
    print("  Searching DDG for B&H Item ID...")
    item_id = search_ddg_bh_item(f"Sony {p['name']} {p['sku']}")

  print(f"  Matched B&H Item ID: {item_id}")
  if item_id:
    primary, gallery = fetch_bh_gallery(item_id)
    print(f"  Primary Image: {primary}")
    print(f"  Gallery Count: {len(gallery)}")
    for g in gallery[:5]:
      print(f"   - {g}")
  time.sleep(1)
