import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3003;

// Increase body size limit for screenshot uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));

// Store active scraping sessions
const activeSessions = new Map();

// SSE endpoint for real-time logs
app.get('/api/scrape/stream', (req, res) => {
  const sessionId = req.query.sessionId;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (sessionId && activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    session.clients.push(res);

    // Send any buffered logs
    if (session.logs.length > 0) {
      session.logs.forEach(log => {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
      });
    }
  }

  req.on('close', () => {
    if (sessionId && activeSessions.has(sessionId)) {
      const session = activeSessions.get(sessionId);
      session.clients = session.clients.filter(c => c !== res);
    }
  });
});

// Helper to send SSE to all clients
function broadcastLog(sessionId, log) {
  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);
    session.logs.push(log);
    session.clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(log)}\n\n`);
      } catch (e) {
        // Client disconnected
      }
    });
  }
}

// API endpoint to start scraper
app.post('/api/scrape', async (req, res) => {
  const { profileUrl, startIndex, endIndex, useAuth, headless, apiToken, instaUsername, instaPassword } = req.body;

  if (!profileUrl || !profileUrl.includes('instagram.com/')) {
    return res.status(400).json({ error: 'Invalid Instagram URL' });
  }

  if (!instaUsername || !instaPassword) {
    return res.status(400).json({ error: 'Instagram credentials are required' });
  }

  const sessionId = Date.now().toString();

  // Initialize session
  activeSessions.set(sessionId, {
    clients: [],
    logs: [],
    profileUrl,
    startTime: Date.now()
  });

  // Send initial response
  res.json({
    success: true,
    sessionId,
    message: 'Scraping started'
  });

  // Start scraping in background
  try {
    const args = [profileUrl, '--start', String(startIndex || 0), '--end', String(endIndex || 20)];
    if (useAuth) args.push('--auth');
    if (headless) args.push('--headless');

    const env = {
      ...process.env,
      VPS_API_TOKEN: apiToken || '',
      INSTAGRAM_USERNAME: instaUsername || '',
      INSTAGRAM_PASSWORD: instaPassword || ''
    };

    const scraper = spawn('node', ['scraper.js', ...args], {
      cwd: __dirname,
      env: env,
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    // Process stdout line by line
    scraper.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Split by lines and broadcast
      const lines = text.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          let type = 'info';
          if (line.includes('✓') || line.includes('✓')) type = 'success';
          else if (line.includes('✗') || line.includes('Error') || line.includes('error')) type = 'error';
          else if (line.includes('⚠') || line.includes('Warning')) type = 'warning';
          else if (line.includes('→')) type = 'progress';
          else if (line.includes('===')) type = 'header';

          broadcastLog(sessionId, {
            type: 'log',
            logType: type,
            message: line.trim(),
            timestamp: Date.now()
          });
        }
      });

      // Parse progress from output
      const progressMatch = text.match(/\[(█+░+)]\s*(\d+)%/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[2]);
        broadcastLog(sessionId, {
          type: 'progress',
          percent,
          timestamp: Date.now()
        });
      }
    });

    scraper.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;

      broadcastLog(sessionId, {
        type: 'log',
        logType: 'error',
        message: text.trim(),
        timestamp: Date.now()
      });
    });

    scraper.on('close', (code) => {
      broadcastLog(sessionId, {
        type: 'complete',
        success: code === 0,
        code,
        timestamp: Date.now()
      });

      // Try to get the latest result file
      setTimeout(async () => {
        try {
          const outputDir = path.join(__dirname, 'output');
          if (fs.existsSync(outputDir)) {
            const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
            if (files.length > 0) {
              const latestFile = files.sort().reverse()[0];
              const data = JSON.parse(fs.readFileSync(path.join(outputDir, latestFile), 'utf8'));

              broadcastLog(sessionId, {
                type: 'results',
                data,
                timestamp: Date.now()
              });
            }
          }
        } catch (err) {
          // No results file
        }

        // Clean up session after 5 minutes
        setTimeout(() => {
          activeSessions.delete(sessionId);
        }, 300000);
      }, 1000);
    });

  } catch (error) {
    broadcastLog(sessionId, {
      type: 'error',
      message: error.message,
      timestamp: Date.now()
    });
  }
});

// Debug endpoint - Start scraper with screenshot streaming
app.post('/api/debug/start', async (req, res) => {
  const { postLink, startIndex, endIndex, instaUsername, instaPassword } = req.body;

  if (!postLink || !postLink.includes('instagram.com/')) {
    return res.status(400).json({ error: 'Invalid Instagram URL' });
  }

  if (!instaUsername || !instaPassword) {
    return res.status(400).json({ error: 'Instagram credentials are required' });
  }

  const sessionId = 'debug-' + Date.now().toString();

  // Initialize debug session
  activeSessions.set(sessionId, {
    clients: [],
    logs: [],
    postLink,
    startTime: Date.now(),
    debugMode: true
  });

  // Send initial response
  res.json({
    success: true,
    sessionId,
    message: 'Debug session started'
  });

  // Start scraping in background with debug mode
  try {
    // Pass the post URL directly - scraper will detect if it's a post or profile URL
    const start = parseInt(startIndex) || 0;
    const end = parseInt(endIndex) || 1;
    const args = [postLink, '--start', String(start), '--end', String(end), '--debug', '--session', sessionId];

    const env = {
      ...process.env,
      INSTAGRAM_USERNAME: instaUsername || '',
      INSTAGRAM_PASSWORD: instaPassword || ''
    };

    const scraper = spawn('node', ['scraper.js', ...args], {
      cwd: __dirname,
      env: env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';

    // Process stdout line by line
    scraper.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      // Split by lines and broadcast
      const lines = text.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          let type = 'info';
          if (line.includes('✓') || line.includes('✓')) type = 'success';
          else if (line.includes('✗') || line.includes('Error') || line.includes('error')) type = 'error';
          else if (line.includes('⚠') || line.includes('Warning')) type = 'warning';
          else if (line.includes('→')) type = 'progress';
          else if (line.includes('===')) type = 'header';

          broadcastLog(sessionId, {
            type: 'log',
            logType: type,
            message: line.trim(),
            timestamp: Date.now()
          });
        }
      });
    });

    scraper.stderr.on('data', (data) => {
      const text = data.toString();
      broadcastLog(sessionId, {
        type: 'log',
        logType: 'error',
        message: text.trim(),
        timestamp: Date.now()
      });
    });

    scraper.on('close', (code) => {
      broadcastLog(sessionId, {
        type: 'complete',
        success: code === 0,
        code,
        timestamp: Date.now()
      });

      // Clean up session after 5 minutes
      setTimeout(() => {
        activeSessions.delete(sessionId);
      }, 300000);
    });

    // Store scraper process reference for potential termination
    activeSessions.get(sessionId).process = scraper;

  } catch (error) {
    broadcastLog(sessionId, {
      type: 'error',
      message: error.message,
      timestamp: Date.now()
    });
  }
});

// Debug endpoint - Upload screenshot from scraper
app.post('/api/debug/screenshot', (req, res) => {
  try {
    const { sessionId, screenshot } = req.body;

    if (!sessionId || !screenshot) {
      return res.status(400).json({ error: 'Missing sessionId or screenshot data' });
    }

    // Broadcast screenshot to all connected clients
    broadcastLog(sessionId, {
      type: 'screenshot',
      data: screenshot,
      timestamp: Date.now()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Screenshot upload error:', error.message);
    res.status(500).json({ error: 'Failed to process screenshot' });
  }
});

// Debug endpoint - Broadcast data from scraper
app.post('/api/debug/broadcast', (req, res) => {
  try {
    const { sessionId, type, data } = req.body;

    if (!sessionId || !type) {
      return res.status(400).json({ error: 'Missing sessionId or type' });
    }

    // Broadcast data to all connected clients
    broadcastLog(sessionId, {
      type: type,
      data: data,
      timestamp: Date.now()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Broadcast error:', error.message);
    res.status(500).json({ error: 'Failed to broadcast data' });
  }
});

// Debug endpoint - Stop debug session
app.post('/api/debug/stop', (req, res) => {
  const { sessionId } = req.body;

  if (activeSessions.has(sessionId)) {
    const session = activeSessions.get(sessionId);

    // Kill the scraper process if it exists
    if (session.process) {
      session.process.kill();
    }

    broadcastLog(sessionId, {
      type: 'complete',
      success: false,
      code: 'TERMINATED',
      timestamp: Date.now()
    });

    res.json({ success: true, message: 'Debug session stopped' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Get latest results
app.get('/api/results', (req, res) => {
  try {
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      return res.json({ files: [] });
    }

    const files = fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.json'))
      .map(file => {
        const stats = fs.statSync(path.join(outputDir, file));
        return { file, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime) // Sort by modification time, newest first
      .map(f => f.file);

    const results = files.map(file => {
      const data = JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf8'));
      const stats = fs.statSync(path.join(outputDir, file));
      return {
        file,
        mtime: stats.mtime,
        ...data
      };
    });

    res.json({ files, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PARSE MANAGEMENT API ENDPOINTS
// ============================================

// Helper: Extract session ID from filename
function extractSessionId(filename) {
  const match = filename.match(/scraped-([a-f0-9]+)-/);
  return match ? match[1] : filename;
}

// Helper: Ensure sessions-index.csv exists
function ensureSessionsIndex() {
  const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');
  if (!fs.existsSync(indexPath)) {
    const headers = 'session_id,json_file,username,profile_url,scrape_timestamp,total_posts,parse_status,parse_timestamp,vps_sent,vps_sent_timestamp\n';
    fs.writeFileSync(indexPath, headers, 'utf8');
  }
  return indexPath;
}

// Create CSV from existing JSON session
app.post('/api/parse/create-csv', (req, res) => {
  try {
    const { jsonFile } = req.body;

    if (!jsonFile) {
      return res.status(400).json({ error: 'jsonFile is required' });
    }

    const jsonPath = path.join(__dirname, 'output', jsonFile);
    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({ error: 'JSON file not found' });
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const sessionId = extractSessionId(jsonFile);

    // Create CSV for this session
    const csvPath = path.join(__dirname, 'parsed', `parsed-${sessionId}-${Date.now()}.csv`);
    const csvHeaders = 'session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited\n';

    let csvContent = csvHeaders;

    for (const post of jsonData.posts || []) {
      const row = [
        sessionId,
        jsonFile,
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

    // Update sessions index
    const indexPath = ensureSessionsIndex();
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    const newEntry = `${sessionId},${jsonFile},${jsonData.username || ''},${jsonData.profileUrl || ''},${jsonData.timestamp || ''},${jsonData.posts?.length || 0},pending,,,0,\n`;
    fs.appendFileSync(indexPath, newEntry, 'utf8');

    res.json({
      success: true,
      csvPath: `/parsed/parsed-${sessionId}-${Date.now()}.csv`,
      sessionId,
      totalPosts: jsonData.posts?.length || 0
    });
  } catch (error) {
    console.error('Create CSV error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all parse sessions
app.get('/api/parse/sessions', (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');

    if (!fs.existsSync(indexPath)) {
      return res.json({ sessions: [] });
    }

    const content = fs.readFileSync(indexPath, 'utf8');
    const lines = content.trim().split('\n').slice(1); // Skip header

    const sessions = lines
      .filter(line => line.trim())
      .map(line => {
        const [
          sessionId, jsonFile, username, profileUrl, scrapeTimestamp,
          totalPosts, parseStatus, parseTimestamp, vpsSent, vpsSentTimestamp
        ] = line.split(',');

        return {
          sessionId,
          jsonFile,
          username,
          profileUrl,
          scrapeTimestamp,
          totalPosts: parseInt(totalPosts) || 0,
          parseStatus: parseStatus || 'pending',
          parseTimestamp,
          vpsSent: vpsSent === '1',
          vpsSentTimestamp
        };
      })
      .sort((a, b) => (b.scrapeTimestamp || '').localeCompare(a.scrapeTimestamp || ''));

    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get CSV data for editing
app.get('/api/parse/csv-data', (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const parsedDir = path.join(__dirname, 'parsed');
    const files = fs.readdirSync(parsedDir)
      .filter(f => f.startsWith(`parsed-${sessionId}`) && f.endsWith('.csv'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return res.status(404).json({ error: 'CSV file not found for this session' });
    }

    const csvPath = path.join(parsedDir, files[0]);
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n').slice(1); // Skip header

    // Helper function to parse CSV line with quoted fields
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

    const posts = lines.map((line, idx) => {
      const parts = parseCSVLine(line);
      const postIndex = parseInt(parts[2]) || idx;
      return {
        postIndex,
        postUrl: parts[3] || '',
        originalCaption: (parts[4] || '').replace(/^"|"$/g, '').replace(/""/g, '"'),
        extractedTitle: parts[5] || '',
        extractedOrganizer: parts[6] || '',
        extractedDate: parts[7] || '',
        extractedLocation: parts[8] || '',
        registrationFee: parts[9] || '',
        phoneNumbers: parts[10] || '',
        contactPersons: parts[11] || '',
        parseStatus: parts[12] || 'pending',
        parseTimestamp: parts[13] || '',
        lastEdited: parts[14] || ''
      };
    });

    res.json({
      sessionId,
      csvPath: files[0],
      posts
    });
  } catch (error) {
    console.error('Get CSV data error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update CSV with edited/parsed data
app.post('/api/parse/update-csv', (req, res) => {
  try {
    const { sessionId, csvFile, updates } = req.body;

    if (!sessionId || !csvFile || !updates) {
      return res.status(400).json({ error: 'sessionId, csvFile, and updates are required' });
    }

    const csvPath = path.join(__dirname, 'parsed', csvFile);
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({ error: 'CSV file not found' });
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0];
    const dataLines = lines.slice(1);

    // Apply updates
    for (const update of updates) {
      const lineIdx = dataLines.findIndex(line => {
        const parts = line.split(',');
        return parseInt(parts[2]) === update.postIndex;
      });

      if (lineIdx !== -1) {
        const parts = dataLines[lineIdx].split(',');
        // Update specific fields
        if (update.field === 'title') parts[5] = update.value;
        if (update.field === 'organizer') parts[6] = update.value;
        if (update.field === 'date') parts[7] = update.value;
        if (update.field === 'location') parts[8] = update.value;
        if (update.field === 'fee') parts[9] = update.value;
        if (update.field === 'phones') parts[10] = update.value;
        if (update.field === 'contacts') parts[11] = update.value;
        if (update.field === 'status') {
          parts[12] = update.value;
          parts[13] = new Date().toISOString();
        }
        if (update.field === 'edited') {
          parts[14] = new Date().toISOString();
        }
        dataLines[lineIdx] = parts.join(',');
      }
    }

    fs.writeFileSync(csvPath, headers + '\n' + dataLines.join('\n'), 'utf8');

    res.json({ success: true, updatedRows: updates.length });
  } catch (error) {
    console.error('Update CSV error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Mark session parse status
app.post('/api/parse/mark-status', (req, res) => {
  try {
    const { sessionId, status } = req.body;

    if (!sessionId || !status) {
      return res.status(400).json({ error: 'sessionId and status are required' });
    }

    const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');
    if (!fs.existsSync(indexPath)) {
      return res.status(404).json({ error: 'Sessions index not found' });
    }

    const content = fs.readFileSync(indexPath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0];
    const dataLines = lines.slice(1);

    let found = false;
    const updatedLines = dataLines.map(line => {
      const parts = line.split(',');
      if (parts[0] === sessionId) {
        found = true;
        parts[6] = status; // parse_status
        if (status === 'parsed' || status === 'done') {
          parts[7] = new Date().toISOString(); // parse_timestamp
        }
      }
      return parts.join(',');
    });

    if (!found) {
      return res.status(404).json({ error: 'Session not found in index' });
    }

    fs.writeFileSync(indexPath, headers + '\n' + updatedLines.join('\n'), 'utf8');

    res.json({ success: true, sessionId, status });
  } catch (error) {
    console.error('Mark status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Send parsed data to VPS
app.post('/api/parse/send-to-vps', async (req, res) => {
  try {
    const { sessionId, csvFile } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Get CSV file
    const parsedDir = path.join(__dirname, 'parsed');
    let targetCsv = csvFile;

    if (!targetCsv) {
      const files = fs.readdirSync(parsedDir)
        .filter(f => f.startsWith(`parsed-${sessionId}`) && f.endsWith('.csv'))
        .sort()
        .reverse();
      if (files.length > 0) targetCsv = files[0];
    }

    if (!targetCsv) {
      return res.status(404).json({ error: 'No CSV file found for this session' });
    }

    const csvPath = path.join(parsedDir, targetCsv);
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.trim().split('\n').slice(1);

    // Helper function to parse CSV line with quoted fields
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

    // Convert CSV rows to post data format
    const posts = lines.map(line => {
      const parts = parseCSVLine(line);
      const phoneStr = parts[10] || '';
      const phones = phoneStr.split(';').filter(p => p.trim());
      const dateStr = parts[7] || '';

      // Validate date format (YYYY-MM-DD or ISO date)
      let validDate = null;
      if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        validDate = dateStr;
      }

      return {
        postIndex: parseInt(parts[2]) || 0,
        postUrl: parts[3] || '',
        postDate: validDate,
        eventTitle: parts[5] || '',
        eventOrganizer: parts[6] || '',
        phoneNumber1: phones[0] || null,
        phoneNumber2: phones[1] || null,
        allPhones: phones,
        caption: (parts[4] || '').replace(/^"|"$/g, '').replace(/""/g, '"')
      };
    }).filter(post => {
      // Only send posts that have at least a title or date parsed
      return post.eventTitle && post.eventTitle.length > 0;
    });

    if (posts.length === 0) {
      return res.json({
        success: true,
        sessionId,
        sentPosts: 0,
        totalPosts: lines.length,
        message: 'No valid posts to send (posts must have parsed title)'
      });
    }

    // Send to VPS using apiClient
    const apiClientModule = await import('./apiClient.js');
    const apiClient = apiClientModule.default;

    // First, create a new session on VPS to get a valid session ID
    let vpsSessionId = sessionId;
    try {
      // Get the original session data to find profile URL
      const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      const indexLines = indexContent.trim().split('\n').slice(1);

      const sessionData = indexLines
        .map(line => line.split(','))
        .find(parts => parts[0] === sessionId);

      if (!sessionData) {
        return res.status(404).json({ error: 'Session not found in index' });
      }

      const profileUrl = sessionData[3]; // profile_url is at index 3
      const totalPosts = parseInt(sessionData[5]) || 0;

      // Create the session on VPS
      const sessionResponse = await apiClient.createLocalSession(profileUrl, 0, totalPosts - 1, false);
      vpsSessionId = sessionResponse.session?.id || sessionResponse.sessionId;

      if (!vpsSessionId) {
        console.error('[VPS] Failed to get session ID from response:', sessionResponse);
        return res.status(500).json({ error: 'Failed to create session on VPS' });
      }

      console.log('[VPS] Created session, VPS Session ID:', vpsSessionId);
    } catch (err) {
      console.error('[VPS] Failed to create session:', err.message);
      return res.status(500).json({ error: 'Failed to create session on VPS: ' + err.message });
    }

    // Upload each post using the VPS session ID
    let successCount = 0;
    for (const post of posts) {
      try {
        await apiClient.uploadScrapedPost(vpsSessionId, post);
        successCount++;
      } catch (err) {
        console.error('Failed to upload post:', post.postIndex, err.message);
      }
    }

    // Update sessions index
    const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');
    const content = fs.readFileSync(indexPath, 'utf8');
    const lines2 = content.trim().split('\n');
    const headers = lines2[0];
    const dataLines = lines2.slice(1);

    const updatedLines = dataLines.map(line => {
      const parts = line.split(',');
      if (parts[0] === sessionId) {
        parts[8] = '1'; // vps_sent
        parts[9] = new Date().toISOString(); // vps_sent_timestamp
      }
      return parts.join(',');
    });

    fs.writeFileSync(indexPath, headers + '\n' + updatedLines.join('\n'), 'utf8');

    res.json({
      success: true,
      sessionId,
      sentPosts: successCount,
      totalPosts: posts.length,
      sentAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Send to VPS error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get VPS send status
app.get('/api/parse/vps-status', (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const indexPath = path.join(__dirname, 'parsed', 'sessions-index.csv');
    if (!fs.existsSync(indexPath)) {
      return res.json({ sent: false });
    }

    const content = fs.readFileSync(indexPath, 'utf8');
    const lines = content.trim().split('\n').slice(1);

    const session = lines
      .map(line => line.split(','))
      .find(parts => parts[0] === sessionId);

    if (!session) {
      return res.json({ sent: false });
    }

    res.json({
      sent: session[8] === '1',
      sentAt: session[9] || null
    });
  } catch (error) {
    console.error('VPS status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🕷️  Instagram Scraper UI running at: http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop\n`);
});
