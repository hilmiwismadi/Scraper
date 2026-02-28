import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import apiClient from './apiClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3003;

// Increase body size limit for screenshot uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Serve main UI at root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'parse-manager.html'));
});

// Handle favicon.ico request
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No content
});

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
    const args = [postLink, '--start', String(start), '--end', String(end), '--auth', '--debug', '--session', sessionId];

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
  // Match pattern: scraped#2-340cc8b6-1770628297209.json OR scraped#3-7d7032e0-4aa4-...-1771456661905.json
  const match = filename.match(/^scraped#\d+-(.+)-(\d{13})\.json$/);
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

    // Get increment number for this session (count existing CSV files for this session)
    const parsedDir = path.join(__dirname, 'parsed');
    const existingFiles = fs.readdirSync(parsedDir)
      .filter(f => f.startsWith(`parsed-${sessionId}-`) && f.endsWith('.csv'))
      .length;
    const increment = existingFiles + 1;

    // Create CSV for this session with increment number
    const csvPath = path.join(__dirname, 'parsed', `parsed#${increment}-${sessionId}-${Date.now()}.csv`);
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
    const newEntry = `${sessionId},parsed#${increment}-${sessionId}-${Date.now()}.csv,${jsonData.username || ''},${jsonData.profileUrl || ''},${jsonData.timestamp || ''},${jsonData.posts?.length || 0},pending,,,0,\n`;
    fs.appendFileSync(indexPath, newEntry, 'utf8');

    // Extract just the filename for the response
    const csvFileName = path.basename(csvPath);

    res.json({
      success: true,
      csvPath: `/parsed/${csvFileName}`,
      csvFileName,
      sessionId,
      totalPosts: jsonData.posts?.length || 0
    });
  } catch (error) {
    console.error('Create CSV error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all parse sessions
// MASTER_RULE.md: Read JSON files from /output folder (Claude's parsed results)
app.get('/api/parse/sessions', (req, res) => {
  try {
    const outputDir = path.join(__dirname, 'output');

    if (!fs.existsSync(outputDir)) {
      return res.json({ sessions: [] });
    }

    // Read all JSON files in /output folder (excluding example files)
    const files = fs.readdirSync(outputDir)
      .filter(f => f.match(/^scraped#(\d+)-.*\.json$/))
      .map(f => {
        const filePath = path.join(outputDir, f);
        const stats = fs.statSync(filePath);
        return { filename: f, mtime: stats.mtime };
      })
      .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

    const sessions = files.map(file => {
      // Extract session ID and increment from filename
      const match = file.filename.match(/^scraped#(\d+)-(.+)-(\d{13})\.json$/);
      if (!match) return null;

      const increment = parseInt(match[1]);
      const sessionId = match[2];
      const timestamp = match[3];
      const scrapeTimestamp = new Date(parseInt(timestamp)).toISOString();

      // Read JSON to get session details
      const filePath = path.join(outputDir, file.filename);
      const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      return {
        sessionId,
        jsonFile: file.filename,
        increment,
        username: jsonData.username || '',
        profileUrl: jsonData.profile_url || '',
        scrapeTimestamp: jsonData.scrape_timestamp || scrapeTimestamp,
        parseTimestamp: jsonData.parse_timestamp || new Date().toISOString(),
        totalPosts: jsonData.posts?.length || 0,
        parseStatus: 'parsed',
        vpsSent: false,
        vpsSentTimestamp: null
      };
    }).filter(s => s !== null);

    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get parsed data for viewing/editing
// MASTER_RULE.md: Read JSON from /output folder (Claude's parsed results)
app.get('/api/parse/csv-data', (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const outputDir = path.join(__dirname, 'output');
    const files = fs.readdirSync(outputDir)
      .filter(f => f.includes(`-${sessionId}-`) && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return res.status(404).json({ error: 'JSON file not found for this session' });
    }

    const jsonPath = path.join(outputDir, files[0]);
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Transform JSON data to format expected by frontend
    const posts = (jsonData.posts || []).map(post => ({
      postIndex: post.post_index,
      postUrl: post.post_url,
      originalCaption: post.original_caption || '',
      extractedTitle: post.extracted_title || '',
      extractedOrganizer: post.extracted_organizer || '',
      extractedDate: post.extracted_date || '',
      extractedLocation: post.extracted_location || '',
      registrationFee: post.registration_fee || '',
      phoneNumbers: Array.isArray(post.phone_numbers) ? post.phone_numbers.join(';') : (post.phone_numbers || ''),
      contactPersons: Array.isArray(post.contact_persons) ? post.contact_persons.join(';') : (post.contact_persons || ''),
      parseStatus: post.parse_status || 'parsed',
      parseTimestamp: jsonData.parse_timestamp || '',
      lastEdited: ''
    }));

    res.json({
      sessionId,
      csvPath: files[0],
      jsonPath: files[0],
      posts,
      summary: jsonData.summary
    });
  } catch (error) {
    console.error('Get JSON data error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update JSON with edited/parsed data
app.post('/api/parse/update-csv', (req, res) => {
  try {
    const { sessionId, csvFile: jsonFile, updates } = req.body;

    if (!sessionId || !jsonFile || !updates) {
      return res.status(400).json({ error: 'sessionId, jsonFile, and updates are required' });
    }

    const jsonPath = path.join(__dirname, 'output', jsonFile);
    if (!fs.existsSync(jsonPath)) {
      return res.status(404).json({ error: 'JSON file not found' });
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Apply updates to posts
    for (const update of updates) {
      const post = jsonData.posts.find(p => p.post_index === update.postIndex);
      if (post) {
        if (update.field === 'title') post.extracted_title = update.value;
        if (update.field === 'organizer') post.extracted_organizer = update.value;
        if (update.field === 'date') post.extracted_date = update.value;
        if (update.field === 'location') post.extracted_location = update.value;
        if (update.field === 'fee') post.registration_fee = update.value;
        if (update.field === 'phones') {
          post.phone_numbers = update.value.split(';').filter(p => p.trim());
        }
        if (update.field === 'contacts') {
          post.contact_persons = update.value.split(';').filter(p => p.trim());
        }
        if (update.field === 'status') {
          post.parse_status = update.value;
        }
        if (update.field === 'edited') {
          post.last_edited = new Date().toISOString();
        }
      }
    }

    // Update parse timestamp
    jsonData.parse_timestamp = new Date().toISOString();

    // Write back to JSON file
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

    res.json({ success: true, updatedRows: updates.length });
  } catch (error) {
    console.error('Update JSON error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Mark session parse status (no longer needed with JSON-based flow, kept for compatibility)
app.post('/api/parse/mark-status', (req, res) => {
  res.json({ success: true, message: 'Status tracking moved to JSON files' });
});

// Send parsed data to VPS
app.post('/api/parse/send-to-vps', async (req, res) => {
  try {
    const { sessionId, csvFile: jsonFile } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // Get JSON file from /output
    const outputDir = path.join(__dirname, 'output');
    let targetJson = jsonFile;

    if (!targetJson) {
      const files = fs.readdirSync(outputDir)
        .filter(f => f.includes(`-${sessionId}-`) && f.endsWith('.json'))
        .sort()
        .reverse();
      if (files.length > 0) targetJson = files[0];
    }

    if (!targetJson) {
      return res.status(404).json({ error: 'No JSON file found for this session' });
    }

    const jsonPath = path.join(outputDir, targetJson);
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    // Convert JSON posts to VPS format
    const posts = (jsonData.posts || []).map(post => {
      const phones = Array.isArray(post.phone_numbers) ? post.phone_numbers : [];
      const dateStr = post.extracted_date || '';

      // Validate date format (YYYY-MM-DD or ISO date)
      let validDate = null;
      if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
        validDate = dateStr;
      }

      return {
        postIndex: post.post_index || 0,
        postUrl: post.post_url || '',
        postDate: validDate,
        eventTitle: post.extracted_title || '',
        eventOrganizer: post.extracted_organizer || '',
        eventLocation: post.extracted_location || '',
        registrationFee: post.registration_fee || '',
        phoneNumber1: phones[0] || null,
        phoneNumber2: phones[1] || null,
        allPhones: phones,
        contactPersons: Array.isArray(post.contact_persons) ? post.contact_persons : [],
        caption: post.original_caption || ''
      };
    }).filter(post => {
      // Only send posts that have at least a title parsed
      return post.eventTitle && post.eventTitle.length > 0;
    });

    if (posts.length === 0) {
      return res.json({
        success: true,
        sessionId,
        sentPosts: 0,
        totalPosts: jsonData.posts?.length || 0,
        message: 'No valid posts to send (posts must have parsed title)'
      });
    }

    console.log('\n========== SENDING TO VPS ==========');
    console.log('Session ID:', sessionId);
    console.log('JSON File:', targetJson);
    console.log('Posts to send:', posts.length);

    // First, create a new session on VPS to get a valid session ID
    let vpsSessionId = sessionId;
    try {
      // Get profile URL and total posts from JSON data
      const profileUrl = jsonData.profile_url || 'https://www.instagram.com/infolomba/';
      const totalPosts = jsonData.posts?.length || posts.length;

      console.log('[VPS] Creating session on VPS...');
      console.log('[VPS] Profile URL:', profileUrl);
      console.log('[VPS] Total posts:', totalPosts);

      // Create the session on VPS
      const sessionResponse = await apiClient.createLocalSession(profileUrl, 0, totalPosts - 1, false);

      // VPS returns: { success: true, sessionId: "uuid", slug: "slug", status: "PENDING" }
      vpsSessionId = sessionResponse.sessionId || sessionResponse.session?.id;

      if (!vpsSessionId) {
        console.error('[VPS] Failed to get session ID from response:', sessionResponse);
        return res.status(500).json({
          error: 'Failed to create session on VPS',
          details: { response: sessionResponse }
        });
      }

      console.log('[VPS] ✓ Session created successfully');
      console.log('[VPS] VPS Session ID:', vpsSessionId);
      console.log('[VPS] Session Slug:', sessionResponse.slug || 'N/A');
      console.log('[VPS] Session Status:', sessionResponse.status || 'N/A');
    } catch (err) {
      console.error('[VPS] ✗ Failed to create session');
      console.error('[VPS] Error:', err.message);
      console.error('[VPS] Status:', err.response?.status);
      console.error('[VPS] Response:', err.response?.data);
      console.error('====================================\n');
      return res.status(500).json({
        error: 'Failed to create session on VPS: ' + err.message,
        details: {
          status: err.response?.status,
          data: err.response?.data
        }
      });
    }

    // Upload all posts to VPS in bulk
    console.log('[VPS] Uploading posts in bulk...');

    try {
      const uploadResult = await apiClient.uploadScrapedPosts(vpsSessionId, posts);

      console.log('[VPS] ✓ Upload complete');
      console.log('[VPS] Uploaded:', uploadResult.uploaded || posts.length);
      console.log('[VPS] Posts with phone:', uploadResult.postsWithPhone || 0);
      console.log('====================================\n');

      // Update JSON file to mark as sent to VPS
      jsonData.vps_sent = true;
      jsonData.vps_sent_timestamp = new Date().toISOString();
      jsonData.vps_sent_count = uploadResult.uploaded || posts.length;
      jsonData.vps_session_id = vpsSessionId;
      fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

      res.json({
        success: true,
        sessionId,
        vpsSessionId,
        sentPosts: uploadResult.uploaded || posts.length,
        totalPosts: posts.length,
        postsWithPhone: uploadResult.postsWithPhone || 0,
        sentAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('[VPS] ✗ Failed to upload posts in bulk');
      console.error('[VPS] Error:', err.message);
      console.error('[VPS] Status:', err.response?.status);
      console.error('[VPS] Response:', err.response?.data);
      console.error('====================================\n');

      return res.status(500).json({
        error: 'Failed to upload posts to VPS: ' + err.message,
        details: {
          status: err.response?.status,
          data: err.response?.data
        }
      });
    }
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

    const outputDir = path.join(__dirname, 'output');
    const files = fs.readdirSync(outputDir)
      .filter(f => f.includes(`-${sessionId}-`) && f.endsWith('.json'));

    if (files.length === 0) {
      return res.json({ sent: false });
    }

    const jsonPath = path.join(outputDir, files[0]);
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    res.json({
      sent: jsonData.vps_sent || false,
      sentAt: jsonData.vps_sent_timestamp || null
    });
  } catch (error) {
    console.error('VPS status error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SETTINGS API ENDPOINTS
// ============================================

// Get current configuration status
app.get('/api/settings/config', (req, res) => {
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Parse .env file
    const envVars = {};
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        envVars[key] = valueParts.join('=');
      }
    });

    res.json({
      vpsApiUrl: envVars.VPS_API_URL || 'https://sales.webbuild.arachnova.id/api',
      hasToken: !!(envVars.VPS_API_TOKEN && envVars.VPS_API_TOKEN.length > 0),
      instaUsername: envVars.INSTAGRAM_USERNAME || ''
    });
  } catch (error) {
    console.error('Get config error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save VPS configuration
app.post('/api/settings/config', (req, res) => {
  try {
    const { vpsApiUrl, vpsApiToken } = req.body;
    const envPath = path.join(__dirname, '.env');

    // Read current .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add VPS_API_URL
    if (vpsApiUrl) {
      if (envContent.includes('VPS_API_URL=')) {
        envContent = envContent.replace(/VPS_API_URL=.*/, `VPS_API_URL=${vpsApiUrl}`);
      } else {
        envContent += `\nVPS_API_URL=${vpsApiUrl}`;
      }
    }

    // Update or add VPS_API_TOKEN (only if provided)
    if (vpsApiToken && vpsApiToken.trim().length > 0) {
      if (envContent.includes('VPS_API_TOKEN=')) {
        envContent = envContent.replace(/VPS_API_TOKEN=.*/, `VPS_API_TOKEN=${vpsApiToken.trim()}`);
      } else {
        envContent += `\nVPS_API_TOKEN=${vpsApiToken.trim()}`;
      }
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent, 'utf8');

    // Reload environment variables
    process.env.VPS_API_URL = vpsApiUrl;
    if (vpsApiToken && vpsApiToken.trim().length > 0) {
      process.env.VPS_API_TOKEN = vpsApiToken.trim();
    }

    res.json({ success: true, message: 'Configuration saved successfully' });
  } catch (error) {
    console.error('Save config error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save Instagram credentials
app.post('/api/settings/instagram', (req, res) => {
  try {
    const { instaUsername, instaPassword } = req.body;
    const envPath = path.join(__dirname, '.env');

    // Read current .env file
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Update or add INSTAGRAM_USERNAME
    if (instaUsername !== undefined) {
      if (envContent.includes('INSTAGRAM_USERNAME=')) {
        envContent = envContent.replace(/INSTAGRAM_USERNAME=.*/, `INSTAGRAM_USERNAME=${instaUsername}`);
      } else {
        envContent += `\nINSTAGRAM_USERNAME=${instaUsername}`;
      }
    }

    // Update or add INSTAGRAM_PASSWORD (only if provided)
    if (instaPassword !== undefined && instaPassword.length > 0) {
      if (envContent.includes('INSTAGRAM_PASSWORD=')) {
        envContent = envContent.replace(/INSTAGRAM_PASSWORD=.*/, `INSTAGRAM_PASSWORD=${instaPassword}`);
      } else {
        envContent += `\nINSTAGRAM_PASSWORD=${instaPassword}`;
      }
    }

    // Write back to .env file
    fs.writeFileSync(envPath, envContent, 'utf8');

    res.json({ success: true, message: 'Instagram credentials saved successfully' });
  } catch (error) {
    console.error('Save Instagram config error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Test VPS connection
app.get('/api/settings/test-connection', async (req, res) => {
  try {
    console.log('\n========== TESTING VPS CONNECTION ==========');
    console.log('VPS_API_URL:', process.env.VPS_API_URL);
    console.log('VPS_API_TOKEN exists:', !!process.env.VPS_API_TOKEN);
    console.log('VPS_API_TOKEN length:', process.env.VPS_API_TOKEN?.length || 0);

    // Try to create a test session (won't actually scrape)
    console.log('Making request to VPS...');

    const testResponse = await Promise.race([
      apiClient.createLocalSession(
        'https://www.instagram.com/test/',
        0,
        1,
        false
      ),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout after 30s')), 30000)
      )
    ]);

    console.log('Test response received:', testResponse);
    console.log('===========================================\n');

    // VPS returns: { success: true, sessionId: "uuid", slug: "slug", status: "PENDING" }
    if (testResponse && testResponse.success && testResponse.sessionId) {
      res.json({
        success: true,
        message: 'VPS connection successful! Session created with ID: ' + testResponse.sessionId,
        details: {
          endpoint: `${process.env.VPS_API_URL}/scraper/local-session`,
          sessionId: testResponse.sessionId,
          slug: testResponse.slug,
          status: testResponse.status,
          responseData: testResponse
        }
      });
    } else {
      res.json({
        success: false,
        error: 'VPS returned unexpected response format',
        details: {
          endpoint: `${process.env.VPS_API_URL}/scraper/local-session`,
          responseData: testResponse
        }
      });
    }
  } catch (error) {
    console.error('\n========== VPS CONNECTION ERROR ==========');
    console.error('Error message:', error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error response:', error.response?.data);
    console.error('Full URL:', error.config?.baseURL + error.config?.url);
    console.error('==========================================\n');

    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      endpoint: error.config?.baseURL + error.config?.url,
      responseData: error.response?.data,
      hasToken: !!process.env.VPS_API_TOKEN
    };

    res.json({
      success: false,
      error: `${error.response?.status || 'Network'} Error: ${error.message}`,
      details: errorDetails
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🕷️  Instagram Scraper UI running at: http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop\n`);
});
