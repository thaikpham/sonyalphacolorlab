const { execSync } = require('child_process');

async function searchBhImages(query) {
  const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  const tokenCmd = `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${searchUrl}"`;
  const tokenHtml = execSync(tokenCmd).toString();
  const vqdMatch = tokenHtml.match(/vqd=["']([^"']+)["']/i) || tokenHtml.match(/vqd=([\d-]+)/i);
  
  if (!vqdMatch) {
    console.log('Could not get vqd token');
    return [];
  }
  const vqd = vqdMatch[1];

  const imgUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}`;
  const imgCmd = `curl -s -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${imgUrl}"`;
  const imgJsonStr = execSync(imgCmd).toString();
  try {
    const data = JSON.parse(imgJsonStr);
    const results = data.results || [];
    const bhImages = results
      .map(r => r.image)
      .filter(u => u && (u.includes('bhphoto') || u.includes('bhphotovideo')));
    console.log(`Query: "${query}" => Found ${bhImages.length} B&H image URLs (total DDG results: ${results.length})`);
    bhImages.forEach((img, i) => console.log(` ${i+1}. ${img}`));
    return bhImages;
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
    return [];
  }
}

const q = process.argv[2] || 'Sony WH-1000XM5 site:bhphotovideo.com';
searchBhImages(q);
