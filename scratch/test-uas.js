const { execSync } = require('child_process');

const uas = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Twitterbot/1.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0'
];

const url = 'https://www.bhphotovideo.com/c/product/1624226-REG/';

for (const ua of uas) {
  try {
    const cmd = `curl -s -L -A "${ua}" "${url}"`;
    const html = execSync(cmd, { timeout: 10000 }).toString();
    const isBlock = html.includes('Just a moment...') || html.includes('Enable JavaScript') || html.includes('Access Denied');
    console.log(`UA: ${ua.slice(0, 40)}... => Length: ${html.length}, Blocked: ${isBlock}`);
    if (!isBlock && html.length > 10000) {
      console.log('SUCCESS! Found page content with UA:', ua);
      break;
    }
  } catch (e) {
    console.log(`UA: ${ua.slice(0, 40)}... => Error: ${e.message}`);
  }
}
