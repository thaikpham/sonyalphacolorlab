const { execSync } = require('child_process');

function getBhImages(url) {
  const cmd = `curl -s -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" -H "Accept-Language: en-US,en;q=0.9" "${url}"`;
  const html = execSync(cmd).toString();
  
  console.log(`Fetched ${url}, HTML length: ${html.length}`);
  if (html.includes('Just a moment...')) {
    console.log('Cloudflare challenge detected');
    return [];
  }
  
  // Find all bhphoto image links in the page source
  const bhImages = [...html.matchAll(/(https?:\\?\/\\?\/static\.bhphoto\.com\\?\/images\\?\/[^\s"'\\]+?\.(?:jpg|png|webp))/gi)]
    .map(m => m[1].replace(/\\/g, ''));
    
  const unique = Array.from(new Set(bhImages));
  console.log(`Found ${unique.length} unique B&H static images:`);
  unique.forEach(img => console.log(' -', img));
  return unique;
}

getBhImages('https://www.bhphotovideo.com/c/replacement_for/1624226-REG/sony_ilme_fx3_fx3_cinema_camera.html');
