import fs from 'fs';

const jsonPath = 'D:\\Hilmi\\Coding\\WebScraper\\output\\scraped-local-1770447396394.json';
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const caption = jsonData.posts[0].caption;

console.log('Caption length:', caption.length);
console.log('Caption ends with:', JSON.stringify(caption.slice(-50)));

// Find all quote characters and their positions
const quotes = [];
for (let i = 0; i < caption.length; i++) {
  if (caption[i] === '"' || caption.charCodeAt(i) === 8221 || caption.charCodeAt(i) === 8222) {
    quotes.push({
      index: i,
      char: caption[i],
      charCode: caption.charCodeAt(i),
      context: caption.substring(Math.max(0, i - 10), i + 10)
    });
  }
}

console.log('\nFound', quotes.length, 'quote characters:');
quotes.forEach(q => {
  console.log(`Index ${q.index}: "${q.char}" (${q.charCode}) at "${q.context}"`);
});
