import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Proper CSV parser that handles quoted fields with escaped quotes
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// List all sessions from sessions-index.csv
function listSessions() {
  const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');

  if (!fs.existsSync(indexPath)) {
    console.log('No sessions found. sessions-index.csv does not exist.');
    return [];
  }

  const content = fs.readFileSync(indexPath, 'utf8');
  const lines = content.trim().split('\n').slice(1); // Skip header

  const sessions = lines
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split(',');
      return {
        sessionId: parts[0],
        jsonFile: parts[1],
        username: parts[2],
        totalPosts: parseInt(parts[5]) || 0,
        parseStatus: parts[6] || 'pending'
      };
    });

  return sessions;
}

// Get session data directly from original JSON (better than CSV parsing)
function getSessionData(sessionId) {
  const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');

  if (!fs.existsSync(indexPath)) {
    return null;
  }

  const content = fs.readFileSync(indexPath, 'utf8');
  const lines = content.trim().split('\n').slice(1);

  const sessionLine = lines.find(line => line.startsWith(sessionId + ','));
  if (!sessionLine) {
    return null;
  }

  const parts = sessionLine.split(',');
  const jsonFile = parts[1];
  const jsonPath = path.join(__dirname, 'output', jsonFile);

  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // Check if there's a parsed CSV with additional data
  const parsedDir = path.join(__dirname, 'parsed');
  const csvFiles = fs.readdirSync(parsedDir)
    .filter(f => f.startsWith(`parsed-${sessionId}`) && f.endsWith('.csv'))
    .sort()
    .reverse();

  // Map of postIndex -> parsed data from CSV
  const parsedDataMap = new Map();

  if (csvFiles.length > 0) {
    const csvPath = path.join(parsedDir, csvFiles[0]);
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const csvLines = csvContent.trim().split('\n').slice(1);

    // Simple CSV parse - handle quoted fields properly for caption
    for (const line of csvLines) {
      // Extract fields, handling quoted caption (field 4)
      const match = line.match(/^([^,]*),([^,]*),(\d+),([^,]*),"([^"]*)",(?:([^,]*),)?(?:([^,]*),)?(?:([^,]*),)?(?:([^,]*),)?(?:([^,]*),)?(?:([^,]*),)?(?:[^,]*),(?:[^,]*),?(?:[^,]*)$/);
      if (match) {
        const postIndex = parseInt(match[3]);
        parsedDataMap.set(postIndex, {
          extractedTitle: match[6] || '',
          extractedOrganizer: match[7] || '',
          extractedDate: match[8] || '',
          extractedLocation: match[9] || '',
          registrationFee: match[10] || '',
          phoneNumbers: match[11] || '',
          parseStatus: match[12] || 'pending'
        });
      }
    }
  }

  // Combine JSON data with any parsed data
  const posts = (jsonData.posts || []).map(post => {
    const parsed = parsedDataMap.get(post.postIndex) || {};
    return {
      postIndex: post.postIndex,
      postUrl: post.postUrl,
      originalCaption: post.caption || '',
      extractedTitle: parsed.extractedTitle || post.eventTitle || '',
      extractedOrganizer: parsed.extractedOrganizer || post.eventOrganizer || '',
      extractedDate: parsed.extractedDate || post.postDate || '',
      extractedLocation: parsed.extractedLocation || '',
      registrationFee: parsed.registrationFee || '',
      phoneNumbers: parsed.phoneNumbers || (post.allPhones || []).join(';'),
      parseStatus: parsed.parseStatus || 'pending'
    };
  });

  return {
    sessionId,
    jsonFile,
    username: jsonData.username || '',
    profileUrl: jsonData.profileUrl || '',
    csvFile: csvFiles.length > 0 ? csvFiles[0] : null,
    posts
  };
}

// Update CSV with parsed data
function updateSessionCsv(sessionId, csvFile, updates) {
  const csvPath = path.join(__dirname, 'parsed', csvFile);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0];
  const dataLines = lines.slice(1);

  // Apply updates
  for (const update of updates) {
    const lineIdx = dataLines.findIndex(line => {
      // Match postIndex in field 3 (0-indexed)
      const match = line.match(/^([^,]*),([^,]*),(\d+),/);
      return match && parseInt(match[3]) === update.postIndex;
    });

    if (lineIdx !== -1) {
      let line = dataLines[lineIdx];

      // Parse the line to replace specific fields
      // Format: session,json,postIndex,url,"caption",title,organizer,date,location,fee,phones,contacts,status,timestamp,edited

      if (update.title !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',title,' + update.title);
      }
      if (update.organizer !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',organizer,' + update.organizer);
      }
      if (update.date !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',date,' + update.date);
      }
      if (update.location !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',location,' + update.location);
      }
      if (update.fee !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',fee,' + update.fee);
      }
      if (update.phones !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',phones,' + update.phones);
      }
      if (update.contacts !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',contacts,' + update.contacts);
      }
      if (update.status !== undefined) {
        line = line.replace(/,("[^"]*"|[^,]*),/, ',status,' + update.status);
      }

      // This is getting complex - let's use a simpler approach
      // Rebuild the line with the update
      dataLines[lineIdx] = line;
    }
  }

  fs.writeFileSync(csvPath, headers + '\n' + dataLines.join('\n'), 'utf8');
  console.log(`Updated ${csvFile} with ${updates.length} changes`);
}

// Update session status in sessions-index.csv
function updateSessionStatus(sessionId, status) {
  const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');
  const content = fs.readFileSync(indexPath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0];
  const dataLines = lines.slice(1);

  const updatedLines = dataLines.map(line => {
    const parts = line.split(',');
    if (parts[0] === sessionId) {
      parts[6] = status;
      if (status === 'parsed' || status === 'done') {
        parts[7] = new Date().toISOString();
      }
    }
    return parts.join(',');
  });

  fs.writeFileSync(indexPath, headers + '\n' + updatedLines.join('\n'), 'utf8');
  console.log(`Updated session ${sessionId} status to ${status}`);
}

// Format posts for Claude to process
function formatPostsForClaude(posts) {
  let output = '# Instagram Captions to Parse\n\n';
  output += 'Please extract the following information from each caption:\n';
  output += '- Event Title\n';
  output += '- Organizer\n';
  output += '- Event Date (YYYY-MM-DD format)\n';
  output += '- Location\n';
  output += '- Registration Fee\n';
  output += '- Phone Numbers (comma separated)\n';
  output += '- Contact Persons with phones (JSON array format)\n\n';
  output += 'Return the results as a JSON array where each object has:\n';
  output += '{ postIndex, title, organizer, date, location, fee, phones, contacts }\n\n';
  output += '--- CAPTIONS TO PARSE ---\n\n';

  for (const post of posts) {
    const captionPreview = post.originalCaption.length > 300
      ? post.originalCaption.substring(0, 300) + '...'
      : post.originalCaption;

    output += `## Post ${post.postIndex}\n`;
    output += `URL: ${post.postUrl}\n`;
    output += `Caption:\n${captionPreview}\n`;
    output += '\n---\n\n';
  }

  return output;
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    console.log('\n=== Parse Sessions ===\n');
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log('No sessions found.');
    } else {
      sessions.forEach(s => {
        console.log(`Session: ${s.sessionId}`);
        console.log(`  File: ${s.jsonFile}`);
        console.log(`  Username: ${s.username}`);
        console.log(`  Posts: ${s.totalPosts}`);
        console.log(`  Status: ${s.parseStatus}`);
        console.log('');
      });
    }
    break;

  case 'show':
    const sessionId = args[1];
    if (!sessionId) {
      console.log('Usage: node processParse.js show <sessionId>');
      process.exit(1);
    }

    const data = getSessionData(sessionId);
    if (!data) {
      console.log(`Session ${sessionId} not found.`);
      process.exit(1);
    }

    console.log(`\n=== Session ${sessionId} ===`);
    console.log(`Username: ${data.username}`);
    console.log(`Total Posts: ${data.posts.length}\n`);

    for (const post of data.posts) {
      const preview = post.originalCaption.length > 100
        ? post.originalCaption.substring(0, 100) + '...'
        : post.originalCaption;
      console.log(`--- Post ${post.postIndex} ---`);
      console.log(`URL: ${post.postUrl}`);
      console.log(`Caption: ${preview}`);
      console.log(`Status: ${post.parseStatus}`);
      console.log('');
    }
    break;

  case 'prepare':
    const prepSessionId = args[1];
    if (!prepSessionId) {
      console.log('Usage: node processParse.js prepare <sessionId>');
      process.exit(1);
    }

    const prepData = getSessionData(prepSessionId);
    if (!prepData) {
      console.log(`Session ${prepSessionId} not found. Use setupSession.js first.`);
      process.exit(1);
    }

    // Filter only pending posts with actual captions
    const pendingPosts = prepData.posts.filter(p =>
      p.parseStatus === 'pending' && p.originalCaption && p.originalCaption.length > 50
    );

    console.log(`\nFound ${pendingPosts.length} posts with captions ready for parsing...\n`);

    if (pendingPosts.length === 0) {
      console.log('No pending posts with captions found.');
      break;
    }

    const formatted = formatPostsForClaude(pendingPosts);

    // Write to a file for easy copying
    const outputFile = path.join(__dirname, 'parse-history', `prepare-${prepSessionId}-${Date.now()}.md`);
    fs.mkdirSync(path.join(__dirname, 'parse-history'), { recursive: true });
    fs.writeFileSync(outputFile, formatted, 'utf8');

    console.log(`Prepared ${pendingPosts.length} captions.`);
    console.log(`Output saved to: ${outputFile}`);
    console.log('\nCopy the content below and paste it to Claude:\n');
    console.log('='.repeat(60));
    console.log(formatted);
    console.log('='.repeat(60));
    break;

  case 'apply':
    const applySessionId = args[1];
    const jsonResults = args[2];

    if (!applySessionId || !jsonResults) {
      console.log('Usage: node processParse.js apply <sessionId> <jsonResults>');
      console.log('Example: node processParse.js apply abc123 \'[{"postIndex":0,"title":"Event Name",...}]\'');
      process.exit(1);
    }

    try {
      const results = JSON.parse(jsonResults);
      const sessionData = getSessionData(applySessionId);

      if (!sessionData) {
        console.log(`Session ${applySessionId} not found.`);
        process.exit(1);
      }

      // Get the CSV file
      if (!sessionData.csvFile) {
        console.log('No CSV file found for this session.');
        process.exit(1);
      }

      // Read current CSV and rebuild with updates
      const csvPath = path.join(__dirname, 'parsed', sessionData.csvFile);
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const csvLines = csvContent.trim().split('\n');
      const csvHeaders = csvLines[0];

      // Build updated CSV lines
      const updatedLines = csvLines.slice(1).map(line => {
        // Use proper CSV parser
        const parts = parseCSVLine(line);

        // Ensure we have at least 15 fields
        while (parts.length < 15) parts.push('');

        const postIdx = parseInt(parts[2]); // post_index is at index 2

        // Find update for this post
        const update = results.find(r => r.postIndex === postIdx);

        if (update) {
          // Update the parsed fields
          parts[5] = update.title || '';           // extracted_title
          parts[6] = update.organizer || '';        // extracted_organizer
          parts[7] = update.date || '';             // extracted_date
          parts[8] = update.location || '';         // extracted_location
          parts[9] = update.fee || '';              // registration_fee
          parts[10] = (update.phones || []).join(';'); // phone_numbers
          parts[11] = JSON.stringify(update.contacts || []); // contact_persons
          parts[12] = 'parsed';                     // parse_status
          parts[13] = new Date().toISOString();     // parse_timestamp
          parts[14] = '';                          // last_edited
        }

        // Rebuild the line, quoting fields that need it
        return parts.map((part, idx) => {
          // Always quote the caption field (index 4)
          if (idx === 4) {
            return '"' + part.replace(/"/g, '""') + '"';
          }
          // Quote fields that contain commas or quotes
          if (part.includes(',') || part.includes('"') || part.includes('\n')) {
            return '"' + part.replace(/"/g, '""') + '"';
          }
          return part;
        }).join(',');
      });

      fs.writeFileSync(csvPath, csvHeaders + '\n' + updatedLines.join('\n'), 'utf8');
      updateSessionStatus(applySessionId, 'parsed');

      console.log(`\nSuccessfully applied ${results.length} parsed results to session ${applySessionId}`);

    } catch (e) {
      console.log('Error:', e.message);
      process.exit(1);
    }
    break;

  case 'status':
    const statusSessionId = args[1];
    const newStatus = args[2];

    if (!statusSessionId || !newStatus) {
      console.log('Usage: node processParse.js status <sessionId> <pending|parsed|done|error>');
      process.exit(1);
    }

    updateSessionStatus(statusSessionId, newStatus);
    break;

  default:
    console.log(`
Claude Parse Manager CLI

Usage:
  node processParse.js list                          - List all sessions
  node processParse.js show <sessionId>              - Show session details
  node processParse.js prepare <sessionId>           - Prepare captions for Claude (prints to console)
  node processParse.js apply <sessionId> <json>      - Apply Claude's JSON results to CSV
  node processParse.js status <sessionId> <status>   - Update session status

Examples:
  node processParse.js list
  node processParse.js show abc123def456
  node processParse.js prepare abc123def456
  node processParse.js apply abc123def456 '[{"postIndex":10,"title":"Event Name","organizer":"Org","date":"2025-01-15","location":"Venue","fee":"Rp 50000","phones":["08123456789"],"contacts":[{"name":"Contact","phone":"08123456789"}]}]'
  node processParse.js status abc123def456 parsed
`);
}
