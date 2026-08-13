const fs = require('fs');

const AUDIO_MAPPING = {
  "sony-wh-1000xm6": "1706637", // WH-1000XM5/XM6 line
  "sony-wh-1000xm5": "1706637",
  "sony-wh-ult900n": "1822839",
  "sony-wh-ch720n": "1754497",
  "sony-wh-ch520": "1754496",
  "sony-wf-1000xm6": "1778672", // WF-1000XM5/XM6 line
  "sony-wf-1000xm5": "1778672",
  "sony-wf-lc900": "1707019",
  "sony-wf-c710n": "1759472",
  "sony-wf-c510": "1846933",
  "sony-inzone-h9-ii": "1713217",
  "sony-inzone-h6-air": "1713218",
  "sony-inzone-h5": "1787680",
  "sony-inzone-buds": "1787682",
  "sony-inzone-e9": "1713217",
  "sony-inzone-h3": "1713219",
  "sony-ult-field-7": "1822840",
  "sony-ult-field-5": "1822840",
  "sony-ult-field-3": "1822838",
  "sony-ult-field-1": "1822838",
  "sony-srs-xb100": "1761823",
  "sony-ult-tower-10": "1822841",
  "sony-ult-tower-9": "1822841",
  "sony-srs-xv800": "1761821",
  "sony-srs-xv500": "1805904"
};

function main() {
  const filePath = 'data/sony-audio.seed.json';
  const products = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  let updated = 0;
  for (const p of products) {
    const itemId = AUDIO_MAPPING[p.id];
    if (itemId) {
      const primaryUrl = `https://static.bhphoto.com/images/images1000x1000/${itemId}.jpg`;
      const fbUrl = `https://static.bhphoto.com/images/fb/${itemId}.jpg`;
      p.imageUrl = primaryUrl;
      p.galleryUrls = [primaryUrl, fbUrl];
      p.url = `https://www.bhphotovideo.com/c/product/${itemId}-REG/`;
      updated++;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(products, null, 2) + '\n');
  console.log(`Updated ${updated}/${products.length} audio products in data/sony-audio.seed.json`);
}

main();
