import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse CSV file with better handling of quote issues
 */
function parseCsvFileRobust(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map(h => h.trim());
  console.log('CSV Headers:', headers);

  const data = [];

  // For data rows, we need to handle the malformed quote issue
  // The caption field closes early due to unescaped curly quotes
  // We'll parse by knowing the expected structure
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Find the field boundaries more carefully
    // Fields 0-3 are simple (no quotes)
    // Field 4 (original_caption) starts with " and has issues
    // Fields 5-14 should be after the caption

    // Split by comma, but account for quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    // Now map to headers, handling shifted data
    const row = {};

    // First 4 fields are always correct
    row[headers[0]] = values[0] || '';
    row[headers[1]] = values[1] || '';
    row[headers[2]] = values[2] || '';
    row[headers[3]] = values[3] || '';

    // Field 4 (original_caption) is values[4] - but may be truncated
    row[headers[4]] = values[4] || '';

    // Due to quote issue, fields are shifted
    // Let's find where the real data is by looking at the pattern
    // The CSV should end with: ,pending,,
    // So we look for "pending" and work backwards

    let pendingIndex = -1;
    for (let j = values.length - 1; j >= 0; j--) {
      if (values[j] === 'pending') {
        pendingIndex = j;
        break;
      }
    }

    if (pendingIndex >= 0) {
      // Found pending, so:
      // pendingIndex-1 = parse_timestamp (should be empty)
      // pendingIndex-2 = last_edited (should be empty)
      // pendingIndex-3 = parse_status (should be pending, but might have phones)
      // pendingIndex-4 = contact_persons (should be empty)
      // pendingIndex-5 = phone_numbers (might have the date or phones)
      // etc.

      // Extract phone numbers - they're usually in the format xxx;xxx
      for (let j = 0; j < values.length; j++) {
        if (/^\d{8,14}(;\d{8,14})*$/.test(values[j].trim())) {
          row['phone_numbers'] = values[j].trim();
          break;
        }
      }

      // Map remaining fields from the end
      row['parse_status'] = values[pendingIndex] || 'pending';
      row['parse_timestamp'] = values[pendingIndex - 1] || '';
      row['last_edited'] = values[pendingIndex - 2] || '';

      // Look for date in ISO format
      for (let j = 0; j < values.length; j++) {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(values[j])) {
          row['extracted_date'] = values[j];
          break;
        }
      }

      // Remaining fields (empty ones)
      row['extracted_title'] = '';
      row['extracted_organizer'] = '';
      row['extracted_location'] = '';
      row['registration_fee'] = '';
      row['contact_persons'] = row['contact_persons'] || '';
    } else {
      // Fallback: just map as-is
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
    }

    data.push(row);
  }

  return data;
}

/**
 * Find the newest parsed CSV file
 */
function findNewestParsedFile() {
  const parsedDir = path.join(__dirname, 'parsed');

  if (!fs.existsSync(parsedDir)) {
    throw new Error('Parsed directory does not exist');
  }

  const files = fs.readdirSync(parsedDir)
    .filter(f => f.startsWith('parsed#') && f.endsWith('.csv'))
    .map(f => {
      const filePath = path.join(parsedDir, f);
      const stats = fs.statSync(filePath);
      return { filename: f, path: filePath, mtime: stats.mtime };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error('No parsed CSV files found');
  }

  return files[0];
}

/**
 * Get corresponding source JSON file
 */
function getSourceJsonFile(sessionId) {
  const outputDir = path.join(__dirname, 'output');

  if (!fs.existsSync(outputDir)) {
    throw new Error('Output directory does not exist');
  }

  const files = fs.readdirSync(outputDir)
    .filter(f => f.includes(sessionId.replace('.json', '')) && f.endsWith('.json'));

  if (files.length === 0) {
    throw new Error(`No source JSON file found for session: ${sessionId}`);
  }

  return path.join(outputDir, files[0]);
}

/**
 * Convert parsed CSV to output JSON
 */
function convertParsedToOutput(parsedCsvPath) {
  console.log('\n=== Converting Parsed CSV to Output JSON ===\n');

  console.log('→ Reading parsed CSV:', parsedCsvPath);
  const parsedData = parseCsvFileRobust(parsedCsvPath);
  console.log('✓ Found', parsedData.length, 'rows');

  if (parsedData.length === 0) {
    throw new Error('No data found in parsed CSV');
  }

  const firstRow = parsedData[0];
  console.log('\nDebug - First row phone_numbers:', firstRow.phone_numbers || 'NOT FOUND');
  console.log('Debug - First row parse_status:', firstRow.parse_status || 'NOT FOUND');
  console.log('Debug - First row extracted_date:', firstRow.extracted_date || 'NOT FOUND');

  const sessionId = firstRow.session_id;
  console.log('\n→ Session ID:', sessionId);

  // Read source JSON
  let sourceData = null;
  try {
    const sourceJsonPath = getSourceJsonFile(sessionId);
    console.log('→ Reading source JSON...');
    sourceData = JSON.parse(fs.readFileSync(sourceJsonPath, 'utf8'));
    console.log('✓ Source JSON loaded');
  } catch (error) {
    console.warn('⚠ Could not read source JSON:', error.message);
  }

  const outputData = {
    profileUrl: sourceData?.profileUrl || 'https://www.instagram.com/infolomba/',
    username: sourceData?.username || 'infolomba',
    timestamp: new Date().toISOString(),
    startTime: sourceData?.startTime || new Date().toISOString(),
    parseTimestamp: new Date().toISOString(),
    posts: []
  };

  for (const row of parsedData) {
    const postIndex = parseInt(row.post_index);
    const postData = sourceData?.posts?.find(p => p.postIndex === postIndex) || {};

    // Get phone numbers - prefer source JSON, fall back to CSV
    let phoneNumbers = postData.allPhones || [];
    if (phoneNumbers.length === 0 && row.phone_numbers) {
      phoneNumbers = row.phone_numbers.split(';').filter(p => p.trim());
    }

    outputData.posts.push({
      postIndex: postIndex,
      postUrl: row.post_url,
      postDate: postData.postDate || row.extracted_date || null,
      caption: row.original_caption || postData.caption || '',
      imageUrl: postData.imageUrl || null,
      eventTitle: row.extracted_title || null,
      eventOrganizer: row.extracted_organizer || null,
      eventLocation: row.extracted_location || null,
      registrationFee: row.registration_fee || null,
      contactPersons: row.contact_persons || null,
      phoneNumber1: phoneNumbers[0] || null,
      phoneNumber2: phoneNumbers[1] || null,
      phoneNumber3: phoneNumbers[2] || null,
      phoneNumber4: phoneNumbers[3] || null,
      allPhones: phoneNumbers,
      parseStatus: row.parse_status || 'pending',
      lastEdited: row.last_edited || null
    });
  }

  const withPhone = outputData.posts.filter(p => p.allPhones && p.allPhones.length > 0).length;
  const parsed = outputData.posts.filter(p => p.parseStatus === 'parsed').length;

  outputData.summary = {
    total: outputData.posts.length,
    withPhone: withPhone,
    parsed: parsed,
    pending: outputData.posts.length - parsed
  };

  const outputFilename = `parsed-${sessionId.replace('.json', '')}-${Date.now()}.json`;
  const outputPath = path.join(__dirname, 'output', outputFilename);

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('\n→ Writing output JSON:', outputFilename);
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
  console.log('✓ Output JSON created');

  console.log('\n=== Summary ===');
  console.log('Total posts:', outputData.summary.total);
  console.log('With phone:', outputData.summary.withPhone);
  console.log('Parsed:', outputData.summary.parsed);
  console.log('Pending:', outputData.summary.pending);
  console.log('\n✓ Done! Output saved to:', outputFilename);

  return outputPath;
}

async function main() {
  try {
    const newestFile = findNewestParsedFile();
    console.log('Newest parsed file:', newestFile.filename);

    const outputPath = convertParsedToOutput(newestFile.path);

    console.log('\n✓ Success!');
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
