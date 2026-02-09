import fs from 'fs';

const csvPath = 'D:\\Hilmi\\Coding\\WebScraper\\parsed\\parsed#1-scraped-local-1770447396394.json-1770447437360.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');
const dataLine = lines[1];

const parseLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  let quoteCount = 0;
  let transitions = [];

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      quoteCount++;
      const beforeState = inQuotes ? 'IN_QUOTES' : 'NOT_IN_QUOTES';
      if (inQuotes && nextChar === '"') {
        current += '"';
        transitions.push(`Index ${i}: ESCAPED quote, staying IN_QUOTES`);
        i++;
      } else {
        inQuotes = !inQuotes;
        transitions.push(`Index ${i}: Quote toggled from ${beforeState} to ${inQuotes ? 'IN_QUOTES' : 'NOT_IN_QUOTES'}`);
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      transitions.push(`Index ${i}: Comma separator (pushed field, length ${current.length})`);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  transitions.push(`End: Pushed final field (length ${current.length})`);

  return { result, transitions, quoteCount };
};

const { result, transitions, quoteCount } = parseLine(dataLine);

console.log('Total quote characters:', quoteCount);
console.log('\nQuote transitions:');
transitions.slice(0, 30).forEach(t => console.log(t));
console.log('\n... (transitions omitted) ...\n');
transitions.slice(-10).forEach(t => console.log(t));

console.log('\nLast 50 chars of dataLine:', JSON.stringify(dataLine.slice(-50)));
