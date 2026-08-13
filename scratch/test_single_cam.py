import json
import re
from curl_cffi import requests
from bs4 import BeautifulSoup

def fetch_bh_product(item_id):
  url = f"https://www.bhphotovideo.com/c/product/{item_id}-REG/"
  r = requests.get(url, impersonate="chrome120", timeout=12)
  print(f"Status: {r.status_code}, Length: {len(r.text)}")
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

  return primary_img, gallery_set

primary, gallery = fetch_bh_product('1899230')
print("Primary:", primary)
print("Gallery count:", len(gallery))
