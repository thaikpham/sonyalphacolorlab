const fs = require('fs');

function fixDomainsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const count = (content.match(/www\.bhphotovideo\.com\/images/g) || []).length;
  if (count > 0) {
    content = content.replace(/https:\/\/www\.bhphotovideo\.com\/images/g, 'https://static.bhphoto.com/images');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Replaced ${count} occurrences in ${filePath}`);
  } else {
    console.log(`No www.bhphotovideo.com/images found in ${filePath}`);
  }
}

fixDomainsInFile('data/sony-cameras.seed.json');
fixDomainsInFile('data/sony-audio.seed.json');
