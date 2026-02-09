import fs from 'fs';

const csvPath = 'D:\\Hilmi\\Coding\\WebScraper\\parsed\\parsed#1-scraped-local-1770447396394.json-1770447437360.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');
const dataLine = lines[1];

// Find what's around index 1674
const contextStart = 1660;
const contextEnd = 1690;
const context = dataLine.substring(contextStart, contextEnd);

console.log('Context around index 1674:');
console.log('Indices:', [...Array(contextEnd - contextStart).keys()].map(i => i + contextStart).join('  '));
console.log('Chars:  ', context.split('').join('  '));
console.log('\nText:', JSON.stringify(context));

// Also show what field comes after index 1675
console.log('\n\nNext field (after the premature quote close):');
const nextField = dataLine.substring(1675, 1700);
console.log('Next field:', JSON.stringify(nextField));

// And show what should have been part of caption
const captionEnd = dataLine.substring(1660, 1685);
console.log('\nCaption ending (should have been part of caption):');
console.log(captionEnd);
