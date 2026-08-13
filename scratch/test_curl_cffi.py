import re
from curl_cffi import requests
from bs4 import BeautifulSoup

url = "https://www.bhphotovideo.com/c/product/1624226-REG/"
print(f"Fetching {url} with curl_cffi...")

r = requests.get(url, impersonate="chrome120")
print(f"Status Code: {r.status_code}, Length: {len(r.text)}")

if r.status_code == 200:
    soup = BeautifulSoup(r.text, 'html.parser')
    print("Page Title:", soup.title.string if soup.title else "No title")
    
    # Extract images
    imgs = re.findall(r'https?:\\?/\\?/static\.bhphoto\.com\\?/images\\?/[^\s"\'\\]+?\.(?:jpg|png|webp)', r.text)
    clean_imgs = list(set([i.replace('\\', '') for i in imgs]))
    print(f"Found {len(clean_imgs)} static.bhphoto.com images:")
    for img in clean_imgs[:15]:
        print(" -", img)
