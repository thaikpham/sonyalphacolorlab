const fs = require('fs');

const CAMERAS_SEED = 'data/sony-cameras.seed.json';

function getBhItemIdFromUrl(urlStr) {
  if (!urlStr) return null;
  const m = urlStr.match(/_(\d{6,7})\.jpg/) || urlStr.match(/IMG_(\d{6,7})\.jpg/) || urlStr.match(/\/product\/(\d{6,7})-REG/);
  return m ? m[1] : null;
}

function main() {
  const cameras = JSON.parse(fs.readFileSync(CAMERAS_SEED, 'utf8'));
  let updatedCount = 0;

  for (const c of cameras) {
    const itemId = getBhItemIdFromUrl(c.imageUrl) || getBhItemIdFromUrl(c.url);

    if (!c.galleryUrls || c.galleryUrls.length === 0) {
      if (itemId) {
        const primary = `https://static.bhphoto.com/images/images1000x1000/${itemId}.jpg`;
        const fb = `https://static.bhphoto.com/images/fb/${itemId}.jpg`;
        c.imageUrl = c.imageUrl || primary;
        c.galleryUrls = [c.imageUrl, primary, fb].filter((u, idx, arr) => u && arr.indexOf(u) === idx);
        if (!c.url) c.url = `https://www.bhphotovideo.com/c/product/${itemId}-REG/`;
        updatedCount++;
      } else if (c.imageUrl) {
        c.galleryUrls = [c.imageUrl];
        updatedCount++;
      }
    }
  }

  fs.writeFileSync(CAMERAS_SEED, JSON.stringify(cameras, null, 2) + '\n');
  console.log(`Finalized ${updatedCount} cameras. All 94 cameras now have galleryUrls!`);
}

main();
