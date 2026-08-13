const { execSync } = require('child_process');
const fs = require('fs');

const CAMERAS_SEED = 'data/sony-cameras.seed.json';
const AUDIO_SEED = 'data/sony-audio.seed.json';

function cleanSku(sku) {
  if (!sku) return '';
  const base = sku.split('/')[0].split('+')[0].trim();
  return base.replace(/\s+[A-Z0-9]{2,4}$/, '').trim();
}

function fetchBhGalleryForProduct(query, itemIdHint) {
  try {
    const sUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + ' site:bhphotovideo.com')}`;
    const tHtml = execSync(`curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${sUrl}"`, { timeout: 8000 }).toString();
    const vqdMatch = tHtml.match(/vqd=["']([^"']+)["']/i) || tHtml.match(/vqd=([\d-]+)/i);
    if (!vqdMatch) return { itemId: itemIdHint, images: [] };
    const vqd = vqdMatch[1];

    const iUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query + ' site:bhphotovideo.com')}&vqd=${vqd}`;
    const jsonStr = execSync(`curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${iUrl}"`, { timeout: 8000 }).toString();
    const data = JSON.parse(jsonStr);
    const results = data.results || [];
    
    let foundItemId = itemIdHint;
    const images = [];

    for (const r of results) {
      const img = r.image || '';
      if (!img.includes('bhphoto') && !img.includes('bhphotovideo')) continue;
      
      // Exclude logos/junk
      if (['oldIEMessage', 'favicon', 'logo', 'smallimages', 'images150x150', 'images250x250', 'images345x345', 'explora'].some(x => img.includes(x))) {
        continue;
      }

      if (!foundItemId) {
        const m = img.match(/_(\d{6,7})\.jpg/) || img.match(/IMG_(\d{6,7})\.jpg/);
        if (m) foundItemId = m[1];
      }

      let upgraded = img.replace(/\\/g, '');
      upgraded = upgraded.replace(/\/images\d+x\d+\//, '/images1000x1000/');
      if (upgraded.includes('/images/fb/') && foundItemId) {
        upgraded = `https://static.bhphoto.com/images/images1000x1000/${foundItemId}.jpg`;
      }

      if (!images.includes(upgraded)) {
        images.push(upgraded);
      }
    }

    // If item ID was found but primary FB image isn't in list, add high-res primary image
    if (foundItemId) {
      const primaryFb = `https://static.bhphoto.com/images/fb/${foundItemId}.jpg`;
      if (!images.includes(primaryFb)) {
        images.unshift(primaryFb);
      }
    }

    return { itemId: foundItemId, images };
  } catch (e) {
    return { itemId: itemIdHint, images: [] };
  }
}

function processCatalog(filePath, name) {
  console.log(`\n========================================`);
  console.log(` Processing ${name} (${filePath})`);
  console.log(`========================================`);
  
  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let updated = 0;
  let totalGalleryImages = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cSku = cleanSku(item.sku);
    
    let existingItemId = null;
    if (item.imageUrl) {
      const m = item.imageUrl.match(/_(\d{6,7})\.jpg/) || item.imageUrl.match(/IMG_(\d{6,7})\.jpg/);
      if (m) existingItemId = m[1];
    }
    
    const query = `Sony ${item.name} ${cSku}`.trim();
    const result = fetchBhGalleryForProduct(query, existingItemId);

    let finalItemId = result.itemId || existingItemId;
    let gallery = result.images;

    // Fallback query if no images found
    if (gallery.length === 0 && item.name) {
      const fbResult = fetchBhGalleryForProduct(`Sony ${item.name}`, existingItemId);
      if (fbResult.images.length > 0) {
        gallery = fbResult.images;
        if (!finalItemId) finalItemId = fbResult.itemId;
      }
    }

    if (finalItemId && gallery.length === 0) {
      // Direct B&H primary fallback
      gallery.push(`https://static.bhphoto.com/images/fb/${finalItemId}.jpg`);
    }

    if (gallery.length > 0) {
      item.imageUrl = gallery[0];
      item.galleryUrls = gallery;
      if (finalItemId && !item.url) {
        item.url = `https://www.bhphotovideo.com/c/product/${finalItemId}-REG/`;
      }
      updated++;
      totalGalleryImages += gallery.length;
      console.log(`[${i+1}/${items.length}] [SUCCESS] ${item.name} | Primary: ${item.imageUrl.split('/').pop()} | Gallery: ${gallery.length} imgs`);
    } else {
      console.log(`[${i+1}/${items.length}] [WARN] ${item.name} | No B&H images found.`);
    }

    fs.writeFileSync(filePath, JSON.stringify(items, null, 2) + '\n');
  }

  console.log(`FINISHED ${name}: ${updated}/${items.length} updated, total ${totalGalleryImages} gallery images.`);
}

processCatalog(CAMERAS_SEED, 'Sony Cameras & Lenses Catalog');
processCatalog(AUDIO_SEED, 'Sony Audio Catalog');
