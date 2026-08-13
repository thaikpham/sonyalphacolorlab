import re
from curl_cffi import requests

url = "https://www.bhphotovideo.com/c/product/1624226-REG/"
r = requests.get(url, impersonate="chrome120")

# Find all image URLs
matches = re.findall(r'https?:\\?/\\?/(?:static\.bhphoto\.com|www\.bhphotovideo\.com)\\?/images\\?/[^\s"\'\\><]+?\.(?:jpg|png|webp)', r.text)

clean = sorted(list(set([m.replace('\\', '') for m in matches])))
print(f"Found {len(clean)} unique B&H image URLs:")
for img in clean:
    print(img)
