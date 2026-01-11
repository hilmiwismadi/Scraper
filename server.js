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
      .sort()
      .reverse();

    const results = files.map(file => {
      const data = JSON.parse(fs.readFileSync(path.join(outputDir, file), 'utf8'));
      return {
        file,
        ...data
      };
    });

    res.json({ files, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🕷️  Instagram Scraper UI running at: http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop\n`);
});
