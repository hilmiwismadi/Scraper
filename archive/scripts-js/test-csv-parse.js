import fs from 'fs';

const csvPath = 'D:\\Hilmi\\Coding\\WebScraper\\parsed\\parsed#1-scraped-local-1770447396394.json-1770447437360.csv';
const content = fs.readFileSync(csvPath, 'utf8');

// Parse header
const lines = content.split('\n');
const headerLine = lines[0];
const dataLine = lines[1];

console.log('Header line:', headerLine);
console.log('\nData line (first 500 chars):', dataLine.substring(0, 500));
console.log('\nData line (last 300 chars):', dataLine.substring(dataLine.length - 300));

// Test our parser
const parseLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

const headers = parseLine(headerLine);
const values = parseLine(dataLine);

console.log('\n=== Headers ===');
headers.forEach((h, i) => console.log(`${i}: "${h}"`));

console.log('\n=== Values ===');
values.forEach((v, i) => {
  const preview = v.length > 50 ? v.substring(0, 50) + '...' : v;
  console.log(`${i}: "${preview}" (length: ${v.length})`);
});

console.log('\n=== Mapping ===');
headers.forEach((h, i) => {
  const v = values[i] || '';
  const preview = v.length > 40 ? v.substring(0, 40) + '...' : v;
  console.log(`${h}: "${preview}"`);
});
