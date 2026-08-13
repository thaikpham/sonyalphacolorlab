import json
import re
from curl_cffi import requests
from bs4 import BeautifulSoup

url = "https://www.bhphotovideo.com/c/product/1624226-REG/"
r = requests.get(url, impersonate="chrome120")

soup = BeautifulSoup(r.text, 'html.parser')

# Check script tags for data
scripts = soup.find_all('script')
print(f"Total script tags: {len(scripts)}")

for idx, script in enumerate(scripts):
    text = script.string or ""
    if "images" in text or "gallery" in text or "image" in text:
        print(f"\n--- Script #{idx} (length {len(text)}) ---")
        if "1624226" in text:
            print("Contains item ID 1624226!")
            # print preview
            matches = re.findall(r'"(https?:\\?/\\?/[^"]*?(?:images|static)[^"]*?\.(?:jpg|png|webp))"', text)
            if matches:
                print(f" Found {len(matches)} image URLs in script:")
                for m in set(matches[:20]):
                    print("  *", m.replace('\\', ''))

# Check JSON-LD
json_lds = soup.find_all('script', type='application/ld+json')
print(f"\nTotal JSON-LD blocks: {len(json_lds)}")
for j in json_lds:
    try:
        data = json.loads(j.string)
        print("JSON-LD type:", data.get('@type'))
        if 'image' in data:
            print("JSON-LD image:", data['image'])
    except Exception as e:
        pass
