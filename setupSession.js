import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create CSV from JSON session
function createCsvFromJson(jsonFilename) {
  const jsonPath = path.join(__dirname, 'output', jsonFilename);

  if (!fs.existsSync(jsonPath)) {
    console.log('JSON file not found:', jsonPath);
    return;
  }

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Extract session ID from filename
  const match = jsonFilename.match(/scraped-([a-f0-9]+)-/);
  const sessionId = match ? match[1] : jsonFilename;

  // Create CSV for this session
  const csvPath = path.join(__dirname, 'parsed', `parsed-${sessionId}-${Date.now()}.csv`);
  const csvHeaders = 'session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited\n';

  let csvContent = csvHeaders;

  for (const post of jsonData.posts || []) {
    const row = [
      sessionId,
      jsonFilename,
      post.postIndex,
      post.postUrl,
      `"${(post.caption || '').replace(/"/g, '""')}"`,
      post.eventTitle || '',
      post.eventOrganizer || '',
      post.postDate || '',
      '',
      '',
      (post.allPhones || []).join(';'),
      '',
      'pending',
      '',
      ''
    ].join(',');
    csvContent += row + '\n';
  }

  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('✓ CSV created:', csvPath);

  // Update sessions index
  const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');
  const newEntry = `${sessionId},${jsonFilename},${jsonData.username || ''},${jsonData.profileUrl || ''},${jsonData.timestamp || ''},${jsonData.posts?.length || 0},pending,,,0,\n`;
  fs.appendFileSync(indexPath, newEntry, 'utf8');
  console.log('✓ Session added to index');
  console.log('');
  console.log('Session ID:', sessionId);
  console.log('Username:', jsonData.username);
  console.log('Total Posts:', jsonData.posts?.length || 0);
  console.log('');
  console.log('Next steps:');
  console.log('  1. node processParse.js prepare ' + sessionId);
  console.log('  2. Copy output to Claude');
  console.log('  3. node processParse.js apply ' + sessionId + " '<json-result>'");
}

// CLI
const jsonFilename = process.argv[2];

if (!jsonFilename) {
  console.log(`
Usage: node setupSession.js <json-filename>

Example:
  node setupSession.js scraped-6dfe40f8-1768117441149.json

Note: You can use just the session ID:
  node setupSession.js 6dfe40f8
  `);
  process.exit(1);
}

// Allow passing just session ID
let finalFilename = jsonFilename;
if (!jsonFilename.includes('scraped-') && !jsonFilename.endsWith('.json')) {
  // Find the JSON file with this session ID
  const outputDir = path.join(__dirname, 'output');
  const files = fs.readdirSync(outputDir).filter(f => f.includes(jsonFilename) && f.endsWith('.json'));
  if (files.length > 0) {
    finalFilename = files[0];
    console.log('Found file:', finalFilename);
  }
}

createCsvFromJson(finalFilename);
