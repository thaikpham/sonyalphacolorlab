
const { execSync } = require("child_process");
async function search(q) {
  const sUrl = "https://duckduckgo.com/?q=" + encodeURIComponent(q);
  const tHtml = execSync("curl -s -A "Mozilla/5.0" "" + sUrl + """).toString();
  const vqd = (tHtml.match(/vqd=["']([^"']+)["']/i) || tHtml.match(/vqd=([\d-]+)/i))[1];
  const iUrl = "https://duckduckgo.com/i.js?l=us-en&o=json&q=" + encodeURIComponent(q) + "&vqd=" + vqd;
  const json = JSON.parse(execSync("curl -s -A "Mozilla/5.0" "" + iUrl + """).toString());
  return (json.results || []).map(r => r.image).filter(u => u && u.includes("bhphoto"));
}
search("Sony WH-1000XM5 1706637").then(imgs => console.log(imgs));
