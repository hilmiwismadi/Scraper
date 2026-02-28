import { Builder, By, until, Key } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Configuration
const DEFAULT_START_INDEX = parseInt(process.env.DEFAULT_START_INDEX) || 0;
const DEFAULT_END_INDEX = parseInt(process.env.DEFAULT_END_INDEX) || 20;

// Debug mode variables
let debugMode = false;
let debugSessionId = null;
const DEBUG_SERVER_URL = 'http://localhost:3003';

// Function to send screenshot to debug server
async function sendScreenshotToDebugServer(base64Screenshot) {
  if (!debugMode || !debugSessionId) return;

  const postData = JSON.stringify({
    sessionId: debugSessionId,
    screenshot: base64Screenshot
  });

  const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/debug/screenshot',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      resolve();
    });

    req.on('error', (error) => {
      // Silently fail - debug server might not be running
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

// Function to capture and send screenshot
async function captureAndSendScreenshot(driver) {
  if (!debugMode) return;

  try {
    const screenshot = await driver.takeScreenshot();
    await sendScreenshotToDebugServer(screenshot);
  } catch (error) {
    // Silently fail
  }
}

// Function to broadcast scraped data in debug mode
async function broadcastDebugData(type, data) {
  if (!debugMode || !debugSessionId) return;

  const postData = JSON.stringify({
    sessionId: debugSessionId,
    type,
    data
  });

  const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/debug/broadcast',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      resolve();
    });

    req.on('error', (error) => {
      // Silently fail - debug server might not be running
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

// Utility functions
function extractUsername(profileUrl) {
  // Handle direct post URLs: https://www.instagram.com/p/XXXXX/ or https://www.instagram.com/username/p/XXXXX/
  const postMatch = profileUrl.match(/instagram\.com\/([^\/]+)\/p\//);
  if (postMatch) {
    return postMatch[1]; // Return username from /username/p/ format
  }

  // Handle profile URLs: https://www.instagram.com/username/
  const match = profileUrl.match(/instagram\.com\/([^\/]+)/);
  if (match) {
    const part = match[1];
    // If it's "p", it's a direct post URL without username, return unknown
    if (part === 'p') {
      return 'unknown-post';
    }
    return part.replace('/', '');
  }
  return null;
}

function extractPhoneNumbers(text) {
  if (!text) return { phone1: null, phone2: null, phone3: null, phone4: null, allPhones: [] };

  const phones = new Set();

  // Pattern 1: Standard Indonesian formats with prefixes
  // Matches: +62, 62, 0 followed by 8-12 digits
  const standardPattern = /(\+62|62|0)[0-9]{8,12}/g;
  const standardMatches = text.match(standardPattern);
  if (standardMatches) {
    standardMatches.forEach(phone => phones.add(phone));
  }

  // Pattern 2: Phone numbers with dashes like 0851-1784-8841
  const dashedPattern = /(\+62|62|0)?[0-9]{3,4}-[0-9]{4}-[0-9]{4}/g;
  const dashedMatches = text.match(dashedPattern);
  if (dashedMatches) {
    dashedMatches.forEach(phone => {
      // Remove dashes for consistency
      const cleanPhone = phone.replace(/-/g, '');
      phones.add(cleanPhone);
    });
  }

  // Pattern 3: Phone numbers in wa.me/ or whatsapp format
  // Matches: wa.me/6289652287318, wa.me/62XXX, etc.
  const waPattern = /wa\.me\/\+?([0-9]+)/g;
  let waMatch;
  while ((waMatch = waPattern.exec(text)) !== null) {
    phones.add(waMatch[1]);
  }

  // Pattern 4: Numbers in parentheses after names like "(Aryanna) 085218972302"
  const parenPattern = /\([^)]+\)\s*[:\s]*((\+62|62|0)[0-9]{8,12})/g;
  let parenMatch;
  while ((parenMatch = parenPattern.exec(text)) !== null) {
    phones.add(parenMatch[1]);
  }

  // Pattern 5: Numbers after emoji indicators like 📞, 📱, 📲
  const emojiPattern = /[(📞📱📲\s:]+((\+62|62|0)[0-9]{8,12})/g;
  let emojiMatch;
  while ((emojiMatch = emojiPattern.exec(text)) !== null) {
    phones.add(emojiMatch[1]);
  }

  // Pattern 6: Standalone 10-14 digit numbers (likely phone numbers)
  const standalonePattern = /(?<!\d)(\d{10,14})(?!\d)/g;
  const standaloneMatches = text.match(standalonePattern);
  if (standaloneMatches) {
    standaloneMatches.forEach(phone => {
      // Only add if it looks like an Indonesian number (starts with 08 or 62)
      if (phone.startsWith('08') || phone.startsWith('62')) {
        phones.add(phone);
      }
    });
  }

  // Normalize all phone numbers to a consistent format
  const normalizedPhones = Array.from(phones).map(phone => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Convert +62 to 0 for consistency
    if (cleaned.startsWith('+62')) {
      cleaned = '0' + cleaned.substring(3);
    } else if (cleaned.startsWith('62') && !cleaned.startsWith('062')) {
      cleaned = '0' + cleaned.substring(2);
    }

    return cleaned;
  });

  // Remove duplicates after normalization
  const uniquePhones = [...new Set(normalizedPhones)];

  return {
    phone1: uniquePhones[0] || null,
    phone2: uniquePhones[1] || null,
    phone3: uniquePhones[2] || null,
    phone4: uniquePhones[3] || null,
    allPhones: uniquePhones
  };
}

function parseEventTitle(caption) {
  if (!caption) return null;

  const lines = caption.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) return null;

  // Try to find the title from common patterns
  const titlePatterns = [
    // First line is often the title
    lines[0],
    // Look for lines with common title indicators
    ...lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('competition') ||
             lower.includes('lomba') ||
             lower.includes('event') ||
             lower.includes('open') ||
             lower.includes('tournament') ||
             lower.includes('contest');
    })
  ];

  // Return the first non-empty meaningful line
  for (const potential of titlePatterns) {
    if (potential && potential.length > 3 && potential.length < 100) {
      return potential;
    }
  }

  return lines[0] || null;
}

function parseOrganizer(caption) {
  if (!caption) return null;

  const lines = caption.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length < 2) return null;

  // Look for organizer in common positions
  // Usually 2nd or 3rd line, or after certain keywords
  const organizerPatterns = [
    // Lines with "contact person", "hubungi", etc.
    ...lines.filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('contact') ||
             lower.includes('hubungi') ||
             lower.includes('narahubung') ||
             lower.includes('person');
    }),
    // 2nd line often contains organizer or location
    lines[1]
  ];

  return organizerPatterns[0] || lines[1] || null;
}

function parsePostDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

// Generate a random session ID (8 hex characters)
function generateSessionId() {
  return Math.random().toString(16).substring(2, 10);
}

// Get next increment number for parsed files
// MASTER_RULE.md Step 3: Incremental naming
function getNextIncrement() {
  const parsedDir = path.join(__dirname, 'parsed');

  // Ensure parsed directory exists
  if (!fs.existsSync(parsedDir)) {
    fs.mkdirSync(parsedDir, { recursive: true });
    return 1;
  }

  // Read all files in /parsed folder
  const files = fs.readdirSync(parsedDir);

  // Extract increment numbers from filenames matching pattern: parsed#{N}-*.csv (with or without example_ prefix)
  const increments = files
    .filter(f => f.match(/^(example_)?parsed#(\d+)-.*\.csv$/))
    .map(f => {
      const match = f.match(/parsed#(\d+)-/);
      return match ? parseInt(match[1]) : 0;
    });

  // Return highest increment + 1, or 1 if no files found
  return increments.length > 0 ? Math.max(...increments) + 1 : 1;
}

// Create CSV file from scraped data for Claude parsing
// MASTER_RULE.md Step 2-4: Generate one parsed file per run
// Initialize an empty CSV file with headers before scraping starts
function initCsvFile(sessionId) {
  const parsedDir = path.join(__dirname, 'parsed');
  if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true });

  const increment = getNextIncrement();
  const timestamp = Date.now();
  const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
  const csvPath = path.join(parsedDir, csvFilename);

  const headers = 'session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited\n';
  fs.writeFileSync(csvPath, headers, 'utf8');
  console.log(`✓ CSV file initialized: ${csvFilename} (will append incrementally)`);
  return { csvPath, csvFilename };
}

// Append one scraped post as a row to the running CSV — called after each post
function appendPostToCsv(csvPath, sessionId, post) {
  const row = [
    sessionId,
    '',
    post.postIndex,
    post.postUrl,
    `"${(post.caption || '').replace(/"/g, '""').replace(/\u201c/g, '""').replace(/'/g, "''")}"`,
    '',
    '',
    post.postDate ? (post.postDate instanceof Date ? post.postDate.toISOString() : post.postDate) : '',
    '',
    '',
    (post.allPhones || []).join(';'),
    '',
    'pending',
    '',
    ''
  ].join(',') + '\n';
  fs.appendFileSync(csvPath, row, 'utf8');
  const phones = (post.allPhones || []).length;
  console.log(`  💾 Saved to CSV [post ${post.postIndex}] ${phones > 0 ? '📞 ' + phones + ' phone(s)' : 'no phones'} — ${path.basename(csvPath)}`);
}

function createCsvForParsing(sessionId, jsonData) {
  const parsedDir = path.join(__dirname, 'parsed');

  // Ensure parsed directory exists
  if (!fs.existsSync(parsedDir)) {
    fs.mkdirSync(parsedDir, { recursive: true });
  }

  // MASTER_RULE.md Step 3: Get next increment number
  const increment = getNextIncrement();
  const timestamp = Date.now();

  // MASTER_RULE.md Step 2: Filename format: parsed#{increment}-{sessionId}-{timestamp}.csv
  const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
  const csvPath = path.join(parsedDir, csvFilename);

  // MASTER_RULE.md Step 2: CSV Structure
  const csvHeaders = 'session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited\n';

  let csvContent = csvHeaders;

  for (const post of jsonData.posts || []) {
    const row = [
      sessionId,
      '', // json_file - not used in new flow, will be filled by Claude
      post.postIndex,
      post.postUrl,
      `"${(post.caption || '').replace(/"/g, '""').replace(/"/g, '""').replace(/'/g, "''")}"`,
      '', // extracted_title - to be filled by Claude (Step 5)
      '', // extracted_organizer - to be filled by Claude
      post.postDate ? (post.postDate instanceof Date ? post.postDate.toISOString() : post.postDate) : '',
      '', // extracted_location - to be filled by Claude
      '', // registration_fee - to be filled by Claude
      (post.allPhones || []).join(';'),
      '', // contact_persons - to be filled by Claude
      'pending',
      '',
      ''
    ].join(',');
    csvContent += row + '\n';
  }

  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log(`✓ Parsed file created: ${csvFilename} (increment #${increment})`);

  return csvPath;
}

// Progress indicator
function showProgress(current, total, message = '') {
  const percent = Math.round((current / total) * 100);
  const bar = '█'.repeat(Math.floor(percent / 2)) + '░'.repeat(50 - Math.floor(percent / 2));
  process.stdout.write(`\r[${bar}] ${percent}% | ${message}                `);
  if (current === total) process.stdout.write('\n');
}

// Main scraper function
async function scrapeInstagram(options) {
  const {
    profileUrl,
    startIndex = DEFAULT_START_INDEX,
    endIndex = DEFAULT_END_INDEX,
    useAuth = false,
    username: instaUsername,
    password: instaPassword,
    headless = false,
    directPostUrl = null  // New option for direct post scraping in debug mode
  } = options;

  let driver = null;

  try {
    console.log('\n=== Instagram Scraper (Local) ===\n');

    // Check if this is a direct post URL (for debug mode)
    const isDirectPost = profileUrl.includes('/p/');
    if (isDirectPost || directPostUrl) {
      console.log('Mode: Direct Post Scraping');
      console.log('Post URL:', profileUrl);
    } else {
      console.log('Profile:', profileUrl);
      console.log('Range:', startIndex, 'to', endIndex);
    }
    console.log('Auth:', useAuth ? 'Yes' : 'No');
    console.log('Mode:', headless ? 'Headless' : 'Visible (Window will open)');
    console.log('');

    // Validate credentials
    if (!instaUsername || !instaPassword) {
      throw new Error('Instagram credentials are required. Please set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD in .env or web UI.');
    }

    console.log('Username:', instaUsername);

    // Setup Chrome options
    console.log('\n→ Starting Chrome browser...');
    const chromeOptions = new chrome.Options();

    if (headless) {
      chromeOptions.addArguments('--headless=new');
    }

    chromeOptions.addArguments('--no-sandbox');
    chromeOptions.addArguments('--disable-dev-shm-usage');
    chromeOptions.addArguments('--disable-gpu');
    chromeOptions.addArguments('--window-size=960,1080');
    chromeOptions.addArguments('--disable-blink-features=AutomationControlled');
    chromeOptions.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Suppress Chrome warnings and errors
    chromeOptions.addArguments('--log-level=3');
    chromeOptions.addArguments('--enable-features=NetworkService,NetworkServiceInProcess');
    chromeOptions.addArguments('--disable-features=VizDisplayCompositor');
    chromeOptions.addArguments('--disable-software-rasterizer');
    chromeOptions.excludeSwitches(['enable-logging']);

    // Add options to prevent detection
    chromeOptions.excludeSwitches(['enable-automation']);
    chromeOptions.addArguments('--disable-password-manager-storage');
    chromeOptions.addArguments('--disable-save-password-bubble');

    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .build();

    // Prevent infinite hangs: page must load within 30s, implicit wait disabled
    await driver.manage().setTimeouts({ pageLoad: 30000, implicit: 0 });

    console.log('✓ Browser opened');

    // Navigate to Instagram
    console.log('\n→ Navigating to Instagram homepage...');
    await driver.get('https://www.instagram.com/');
    await driver.sleep(4000);
    console.log('✓ Instagram loaded');
    await captureAndSendScreenshot(driver);

    // Always login - Instagram requires it for scraping
    console.log('\n=== Logging in to Instagram ===');

    try {
      // Wait for page to fully load
      await driver.sleep(3000);
      await captureAndSendScreenshot(driver);

      // Try multiple approaches to find and fill the login form
      console.log('→ Looking for login form...');

      let usernameInput = null;
      let passwordInput = null;
      let loginButton = null;

      // Approach 1: Try by name attribute (most common)
      try {
        usernameInput = await driver.wait(until.elementLocated(By.name('username')), 10000);
        console.log('  Found login form by name attribute');
      } catch (e) {
        console.log('  Name attribute not found, trying alternatives...');
      }

      // Approach 2: Try by aria-label
      if (!usernameInput) {
        try {
          usernameInput = await driver.findElement(By.xpath("//input[contains(@aria-label, 'username') or contains(@aria-label, 'Username')]"));
          console.log('  Found login form by aria-label');
        } catch (e) {
          console.log('  aria-label not found');
        }
      }

      // Approach 3: Try by placeholder
      if (!usernameInput) {
        try {
          usernameInput = await driver.findElement(By.xpath("//input[contains(@placeholder, 'username') or contains(@placeholder, 'phone') or contains(@placeholder, 'email')]"));
          console.log('  Found login form by placeholder');
        } catch (e) {
          console.log('  Placeholder not found');
        }
      }

      // Approach 4: Try by CSS selector for input fields
      if (!usernameInput) {
        try {
          const inputs = await driver.findElements(By.css('input[type="text"], input[type="tel"], input:not([type])'));
          if (inputs.length > 0) {
            usernameInput = inputs[0];
            console.log('  Found text input field');
          }
        } catch (e) {
          console.log('  CSS selector not found');
        }
      }

      if (!usernameInput) {
        // Get page title and URL for debugging
        const currentUrl = await driver.getCurrentUrl();
        const pageTitle = await driver.getTitle();
        console.log('  Current URL:', currentUrl);
        console.log('  Page title:', pageTitle);

        // Check if already logged in
        if (currentUrl.includes('instagram.com') && !currentUrl.includes('login')) {
          console.log('  ✓ Already logged in!');
          await captureAndSendScreenshot(driver);
        } else {
          throw new Error('Could not find login input field. Instagram may have changed their login page.');
        }
      } else {
        // Fill in username
        console.log('→ Entering username...');
        await usernameInput.clear();
        await usernameInput.sendKeys(instaUsername);
        await driver.sleep(500);
        await captureAndSendScreenshot(driver);

        // Find password field
        console.log('→ Finding password field...');
        try {
          passwordInput = await driver.findElement(By.name('password'));
        } catch (e) {
          try {
            passwordInput = await driver.findElement(By.xpath("//input[@type='password']"));
          } catch (e2) {
            // Try to find the next input after username
            const inputs = await driver.findElements(By.css('input'));
            if (inputs.length >= 2) {
              passwordInput = inputs[1];
            }
          }
        }

        if (!passwordInput) {
          throw new Error('Could not find password input field');
        }

        console.log('→ Entering password...');
        await passwordInput.clear();
        await passwordInput.sendKeys(instaPassword);
        await driver.sleep(500);
        await captureAndSendScreenshot(driver);

        // Find and click login button
        console.log('→ Finding login button...');
        try {
          loginButton = await driver.findElement(By.xpath('//button[@type="submit"]'));
          console.log('  Found button by type="submit"');
        } catch (e) {
          console.log('  type="submit" not found, trying text...');
          try {
            loginButton = await driver.findElement(By.xpath("//button[contains(text(), 'Log in') or contains(text(), 'Login') or contains(text(), 'Log In')]"));
            console.log('  Found button by text');
          } catch (e2) {
            console.log('  Text search not found, trying div elements...');
            try {
              // Instagram sometimes uses div instead of button
              loginButton = await driver.findElement(By.xpath("//div[contains(text(), 'Log in') or contains(text(), 'Login') or contains(text(), 'Log In')]"));
              console.log('  Found div button by text');
            } catch (e3) {
              console.log('  Div text not found, trying by CSS class...');
              try {
                // Try to find button with specific classes Instagram uses
                loginButton = await driver.findElement(By.css('button._acan._acap._acas._aj1-'));
                console.log('  Found button by class');
              } catch (e4) {
                console.log('  Class not found, getting all buttons...');
                const buttons = await driver.findElements(By.css('button, div[role="button"]'));
                console.log('  Found', buttons.length, 'button-like elements');

                // Look for button with login-related text
                for (const btn of buttons) {
                  try {
                    const text = await btn.getText();
                    const className = await btn.getAttribute('class');
                    console.log(`    Checking button: text="${text}", class="${className}"`);

                    if (text && (text.toLowerCase().includes('log') || text.toLowerCase().includes('login') || text.toLowerCase().includes('in'))) {
                      loginButton = btn;
                      console.log('  Found login button by iterating!');
                      break;
                    }
                  } catch (err) {
                    // Continue to next button
                  }
                }

                // Last resort - use the first button
                if (!loginButton && buttons.length > 0) {
                  console.log('  Using first button as fallback');
                  loginButton = buttons[0];
                }
              }
            }
          }
        }

        if (!loginButton) {
          // Get page source for debugging
          const pageSource = await driver.getPageSource();
          console.log('  Page source length:', pageSource.length);

          // Try pressing Enter as last resort
          console.log('  Trying to submit form with Enter key...');
          await passwordInput.sendKeys(Key.RETURN);
          console.log('✓ Sent Enter key');
        } else {
          console.log('→ Clicking login button...');
          await loginButton.click();
          console.log('✓ Login clicked');
        }
        await captureAndSendScreenshot(driver);

        // Wait for navigation after login
        console.log('→ Waiting for login to complete...');
        await driver.sleep(8000);

        // Handle various post-login dialogs
        console.log('→ Handling post-login prompts...');

        // Handle "Save your login info?"
        try {
          const notNowButton = await driver.findElement(By.xpath("//button[contains(text(), 'Not now') or contains(text(), 'Not Now')]"));
          await notNowButton.click();
          await driver.sleep(2000);
          console.log('✓ Dismissed "Save login" prompt');
        } catch (e) {
          console.log('  No "Save login" prompt found');
        }

        // Handle "Turn on notifications"
        try {
          const notNowButton = await driver.findElement(By.xpath("//button[contains(text(), 'Not now') or contains(text(), 'Not Now')]"));
          await notNowButton.click();
          await driver.sleep(2000);
          console.log('✓ Dismissed notifications prompt');
        } catch (e) {
          console.log('  No notifications prompt found');
        }

        // Verify we're logged in
        const currentUrl = await driver.getCurrentUrl();
        if (currentUrl.includes('instagram.com') && !currentUrl.includes('login')) {
          console.log('✓ Successfully logged in to Instagram');
          await captureAndSendScreenshot(driver);
        } else {
          throw new Error('Login may have failed - still on login page');
        }
      }

    } catch (error) {
      console.error('✗ Login failed:', error.message);
      await captureAndSendScreenshot(driver);
      throw new Error('Failed to login to Instagram: ' + error.message);
    }

    // Check if this is direct post mode (for debugging single posts)
    let postsToScrape = [];
    let adjustedStartIndex = startIndex; // Define here so it's available in both modes

    if (isDirectPost) {
      console.log('\n=== Direct Post Mode ===');
      console.log('→ Going directly to post:', profileUrl);
      postsToScrape = [profileUrl];
      adjustedStartIndex = 0; // For direct post, index is 0
    } else {
      // Normal profile scraping mode
      const username = extractUsername(profileUrl);
      if (!username) {
        throw new Error('Invalid Instagram profile URL');
      }

      console.log('\n=== Navigating to profile @' + username + ' ===');
      await driver.get('https://www.instagram.com/' + username + '/');
      await driver.sleep(5000);
      await captureAndSendScreenshot(driver);

      // Check if private
      const pageText = await driver.findElement(By.tagName('body')).getText();
      if (pageText.includes('This Account is Private') || pageText.includes('Follow this account to see their photos and videos.')) {
        throw new Error('This profile is private. Please login to view posts.');
      }
      console.log('✓ Profile is accessible');

      // Scroll to load posts — accumulate URLs in a running Set
      // Instagram uses virtual scrolling: old posts are removed from DOM as you scroll.
      // Counting DOM elements gives wrong (negative) deltas. A Set fixes this.
      console.log('\n=== Loading posts by scrolling ===');
      console.log('→ Target: collect at least', endIndex, 'unique post URLs');

      const postsPerScroll = 6; // conservative: Instagram can load as few as 3 per scroll on slow pages
      // Allow 3x the naive estimate + 30 buffer so slow networks don't cut off early.
      // The loop exits as soon as enough URLs are collected (or profile ends), so extra iterations are free.
      const scrollIterations = Math.ceil(endIndex / postsPerScroll) * 3 + 30;
      console.log('→ Will scroll up to', scrollIterations, 'times (stops early when enough collected)');

      const collectedUrls = new Set(); // grows monotonically — immune to virtual scroll
      let noNewPostsCount = 0;
      const maxNoNewPosts = 15;
      let actualScrolls = 0;

      for (let i = 0; i < scrollIterations; i++) {
        await driver.executeScript('window.scrollTo(0, document.body.scrollHeight)');
        // Adaptive sleep: longer when Instagram is slow to render the next batch
        const scrollSleep = noNewPostsCount > 0 ? 5000 : 3000;
        await driver.sleep(scrollSleep);

        // Harvest post links — ONLY from the target profile to exclude linked/tagged posts from other accounts
        const prevSize = collectedUrls.size;
        const visibleElements = await driver.findElements(By.css('a[href*="/p/"]'));
        for (const el of visibleElements) {
          try {
            const href = await el.getAttribute('href');
            if (href && href.includes('/' + username + '/p/')) collectedUrls.add(href);
          } catch (e) { /* element went stale, skip */ }
        }
        const newFound = collectedUrls.size - prevSize;

        if ((i + 1) % 5 === 0 || i === 0) {
          showProgress(i + 1, scrollIterations, `Scrolling... (${i + 1}/${scrollIterations}, ${collectedUrls.size} unique posts)`);
          console.log(`  Scrolled ${i + 1} times... ${collectedUrls.size} unique posts collected`);
        }

        if (newFound === 0) {
          noNewPostsCount++;
          console.log(`  No new posts (${noNewPostsCount}/${maxNoNewPosts}), total collected: ${collectedUrls.size}`);
          if (noNewPostsCount >= maxNoNewPosts) {
            console.log(`✓ Stopping: no new posts after ${maxNoNewPosts} scrolls`);
            break;
          }
        } else {
          noNewPostsCount = 0;
          console.log(`  ✓ +${newFound} new posts! Total: ${collectedUrls.size}`);
        }

        actualScrolls++;

        if (collectedUrls.size >= endIndex) {
          console.log(`✓ Collected enough posts (${collectedUrls.size} >= ${endIndex})`);
          break;
        }
      }

      showProgress(actualScrolls, scrollIterations, 'Scrolling complete');
      console.log(`✓ Scrolling complete — ${collectedUrls.size} unique post URLs collected`);

      const postsArray = Array.from(collectedUrls);
      console.log('✓ Found', postsArray.length, 'unique post URLs');

      // Validate and adjust range
      // NOTE: adjustedStartIndex is declared in outer scope (line above) so actualIndex stays correct
      let adjustedEndIndex = endIndex;

      if (startIndex >= postsArray.length) {
        console.log(`⚠ Warning: Start index ${startIndex} exceeds available posts (${postsArray.length})`);
        console.log(`→ Adjusting to scrape all available posts from 0 to ${postsArray.length - 1}`);
        adjustedStartIndex = 0;  // update outer variable — fixes post label bug
        adjustedEndIndex = postsArray.length;
      } else if (endIndex > postsArray.length) {
        console.log(`⚠ Warning: End index ${endIndex} exceeds available posts (${postsArray.length})`);
        adjustedEndIndex = postsArray.length;
      }

      postsToScrape = postsArray.slice(adjustedStartIndex, Math.min(adjustedEndIndex, postsArray.length));
      console.log('→ Will scrape posts', adjustedStartIndex, 'to', Math.min(adjustedEndIndex, postsArray.length) - 1, '(' + postsToScrape.length + ' posts)');
    }

    // Scrape each post
    console.log('\n=== Scraping posts ===\n');

    // Create CSV file NOW with just headers — rows appended incrementally per post
    // This ensures partial results are saved even if the scraper crashes mid-run
    const sessionId = generateSessionId();
    const { csvPath, csvFilename } = initCsvFile(sessionId);

    const scrapedData = [];
    let scrapedCount = 0;
    let phoneCount = 0;

    for (let i = 0; i < postsToScrape.length; i++) {
      const postUrl = postsToScrape[i];
      const actualIndex = isDirectPost ? 0 : adjustedStartIndex + i;

      console.log('\n--- Post ' + (actualIndex + 1) + ' ---');
      console.log('URL:', postUrl);
      console.log('→ Opening post...');

      showProgress(i + 1, postsToScrape.length, `Post ${actualIndex + 1}`);

      try {
        try {
          await driver.get(postUrl);
        } catch (navErr) {
          // Page load timeout (30s exceeded) — try to work with whatever was loaded
          console.log('  ⚠ Page load timed out, attempting to continue with partial content...');
        }
        await driver.sleep(3000);

        // Detect if Instagram redirected us to login/challenge — session may be dead
        const currentUrl = await driver.getCurrentUrl();
        if (
          currentUrl.includes('/login') ||
          currentUrl.includes('/challenge') ||
          currentUrl.includes('/accounts/suspended') ||
          currentUrl.includes('/accounts/disabled')
        ) {
          console.log('⚠ Redirected to: ' + currentUrl);
          console.log('→ Instagram session expired or account challenged. Stopping and saving progress...');
          await captureAndSendScreenshot(driver);
          break; // exit post loop — CSV will be saved below
        }

        console.log('✓ Post page loaded');
        await captureAndSendScreenshot(driver);

        console.log('→ Getting page source for metadata...');
        const pageSource = await driver.getPageSource();

        // Extract caption - Try multiple approaches
        console.log('→ Extracting caption...');
        let caption = '';

        // Approach 0: Extract caption anchored to THIS post's shortcode in the page source JSON.
        // The page source contains JSON for MANY posts (related, suggested, profile feed).
        // Searching the whole page for "longest text" picks up wrong posts — must anchor to shortcode.
        try {
          console.log('  Trying shortcode-anchored page source extraction...');

          // Shortcode is the post ID in the URL: /p/DUm-viNj2Um/ → "DUm-viNj2Um"
          const shortcode = postUrl.match(/\/p\/([^\/\?#]+)/)?.[1];
          console.log('  Shortcode:', shortcode);

          if (shortcode) {
            // Try multiple patterns — Instagram may store shortcode under different key names
            const shortcodePatterns = [
              '"shortcode":"' + shortcode + '"',  // explicit key (most reliable)
              '"code":"' + shortcode + '"',        // alternate key
              '"' + shortcode + '"',               // standalone value
            ];
            let scIdx = -1;
            for (const pat of shortcodePatterns) {
              scIdx = pageSource.indexOf(pat);
              if (scIdx !== -1) {
                console.log('  Found shortcode at index', scIdx, 'via:', pat.substring(0, 40));
                break;
              }
            }

            if (scIdx !== -1) {
              // Larger window: 2000 before + 15000 after (long captions need more room)
              const windowStart = Math.max(0, scIdx - 2000);
              const snippet = pageSource.substring(windowStart, scIdx + 15000);

              // Pattern A: "caption":{ ... "text":"FULL CAPTION" }
              const capKeyIdx = snippet.indexOf('"caption":');
              if (capKeyIdx !== -1) {
                const capSnippet = snippet.substring(capKeyIdx, capKeyIdx + 5000);
                const textMatch = capSnippet.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (textMatch && textMatch[1].length > 0) {
                  try { caption = JSON.parse('"' + textMatch[1] + '"'); }
                  catch (e) { caption = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
                  console.log('  ✓ caption.text (' + caption.length + ' chars)');
                }
              }

              // Pattern B: edge_media_to_caption → edges → node → text
              if (!caption) {
                const edgeIdx = snippet.indexOf('"edge_media_to_caption"');
                if (edgeIdx !== -1) {
                  const edgeSnippet = snippet.substring(edgeIdx, edgeIdx + 5000);
                  const textMatch = edgeSnippet.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                  if (textMatch && textMatch[1].length > 0) {
                    try { caption = JSON.parse('"' + textMatch[1] + '"'); }
                    catch (e) { caption = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
                    console.log('  ✓ edge_media_to_caption (' + caption.length + ' chars)');
                  }
                }
              }

              // Pattern C: first "text":"..." near shortcode
              if (!caption) {
                const textMatch = snippet.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
                if (textMatch && textMatch[1].length > 0) {
                  try { caption = JSON.parse('"' + textMatch[1] + '"'); }
                  catch (e) { caption = textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
                  console.log('  ✓ first text near shortcode (' + caption.length + ' chars)');
                }
              }

              if (!caption) console.log('  ⚠ Shortcode found but no text/caption field nearby');
            } else {
              console.log('  ⚠ Shortcode not found in page source — page may not be fully loaded');
            }
          }
        } catch (e) {
          console.log('  Page source extraction (Approach 0) failed:', e.message);
        }

        // Approach 0b: og:description-anchored full text search.
        // og:description gives us the start of the caption (truncated ~150 chars).
        // Use those first chars as a fingerprint to find the FULL caption text
        // anywhere in the page source JSON (avoids shortcode positioning issues).
        if (!caption) {
          try {
            const ogRaw = pageSource.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/)?.[1];
            if (ogRaw) {
              const ogContent = ogRaw
                .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
              // og format: "N likes, M comments - username on DATE: "caption text..."
              const colonQuoteIdx = ogContent.indexOf(': "');
              if (colonQuoteIdx !== -1) {
                const captionHint = ogContent.substring(colonQuoteIdx + 3).replace(/[.…"]+$/, '').trim();
                // Take first 30 ASCII-safe chars as fingerprint (avoids emoji encoding mismatches)
                const asciiHint = captionHint.replace(/[^\x20-\x7E]/g, '').trim().substring(0, 30);
                if (asciiHint.length >= 8) {
                  console.log('  Trying og:description hint search for:', JSON.stringify(asciiHint));
                  // Scan ALL "text":"..." fields in entire page source, pick longest that contains our hint
                  const textRegex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
                  let m, bestCaption = '';
                  while ((m = textRegex.exec(pageSource)) !== null) {
                    let decoded;
                    try { decoded = JSON.parse('"' + m[1] + '"'); }
                    catch (e) { decoded = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'); }
                    const decodedAscii = decoded.replace(/[^\x20-\x7E]/g, '');
                    if (decodedAscii.includes(asciiHint) && decoded.length > bestCaption.length) {
                      bestCaption = decoded;
                    }
                  }
                  if (bestCaption.length > captionHint.length) {
                    caption = bestCaption;
                    console.log('  ✓ og:hint full caption (' + caption.length + ' chars)');
                  } else if (bestCaption.length > 0) {
                    console.log('  ⚠ og:hint found text but not longer than og:description hint');
                  } else {
                    console.log('  ⚠ og:hint: no matching text field found in page source');
                  }
                }
              }
            }
          } catch (e) {
            console.log('  Approach 0b failed:', e.message);
          }
        }

        // Approach 1: DOM-based extraction (fallback if page source regex missed)
        if (!caption || caption.length < 50) {
          try {
            console.log('  Trying DOM element extraction...');

            // Click "more" / "...more" button to expand truncated caption
            try {
              const allButtons = await driver.findElements(
                By.xpath("//article//button | //article//span[@role='button'] | //*[@aria-label='More options']")
              );
              for (const btn of allButtons) {
                const btnText = await btn.getText();
                if (btnText && /^more$/i.test(btnText.trim())) {
                  await btn.click();
                  await driver.sleep(1000);
                  console.log('  ✓ Clicked "more" to expand caption');
                  break;
                }
              }
            } catch (e) { /* no "more" button — caption already fully visible */ }

            // Try multiple selectors for caption element (pick longest result)
            const captionSelectors = [
              'article h1 span[dir="auto"]',
              'article span[dir="auto"]',
              'div[dir="auto"]',
              'h1[dir="auto"]',
            ];
            let longest = '';
            for (const selector of captionSelectors) {
              try {
                const elements = await driver.findElements(By.css(selector));
                for (const el of elements) {
                  const t = await el.getText();
                  if (t && t.length > longest.length) longest = t;
                }
              } catch (e) {}
            }
            if (longest.length > 50) {
              caption = longest;
              console.log('  ✓ Got caption from DOM element (' + caption.length + ' chars)');
            }
          } catch (e) {
            console.log('  DOM element extraction failed:', e.message);
          }
        }

        // Approach 2: If JSON didn't work, try getting text from the article directly
        if (!caption || caption.length < 100) {
          console.log('  Trying article element...');

          try {
            const articles = await driver.findElements(By.css('article'));
            if (articles.length > 0) {
              const articleText = await articles[0].getText();

              // Clean up the article text
              let cleanText = articleText;

              // Remove common UI elements (buttons, counts, etc)
              const lines = cleanText.split('\n');
              const captionLines = [];
              let inCaption = false;

              for (const line of lines) {
                const trimmed = line.trim();

                // Skip empty lines
                if (!trimmed) continue;

                // Skip UI elements
                if (['like', 'share', 'follow', 'more', 'view all', 'comments', 'sign up', 'log in'].some(x => trimmed.toLowerCase().includes(x))) {
                  continue;
                }

                // Skip numbers that are likely counts
                if (/^\d+$/.test(trimmed)) continue;

                // Skip short lines
                if (trimmed.length < 10) continue;

                // If we find a long line, we're probably in the caption
                if (trimmed.length > 30 || inCaption) {
                  inCaption = true;
                  captionLines.push(trimmed);
                }
              }

              if (captionLines.length > 0) {
                caption = captionLines.join('\n');
                console.log('  ✓ Extracted', captionLines.length, 'lines from article');
              }
            }
          } catch (e) {
            console.log('  Article extraction failed:', e.message);
          }
        }

        // Approach 3: Last resort - parse from page source HTML
        if (!caption || caption.length < 100) {
          console.log('  Trying HTML parsing fallback...');

          // Look for meta tags
          const ogDescMatch = pageSource.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/);
          if (ogDescMatch) {
            const decoded = ogDescMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\\n/g, '\n')
              .trim();

            if (decoded.length > caption.length) {
              caption = decoded;
              console.log('  ✓ Found caption in og:description meta tag');
            }
          }

          // Also try twitter:description
          const twitterDescMatch = pageSource.match(/<meta[^>]*name="twitter:description"[^>]*content="([^"]+)"/);
          if (twitterDescMatch) {
            const decoded = twitterDescMatch[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\\n/g, '\n')
              .trim();

            if (decoded.length > caption.length) {
              caption = decoded;
              console.log('  ✓ Found caption in twitter:description meta tag');
            }
          }
        }

        // Final cleanup
        if (caption) {
          // Remove UI text patterns
          const patternsToRemove = [
            /View all \d+ comments/gi,
            / \d+ likes/gi,
            /Follow/gi,
            /More/gi,
            /Share/gi,
            /Meta/gi,
            /About/gi,
            /Help/gi,
            /Press/gi,
            /API/gi,
            /Jobs/gi,
            /Privacy/gi,
            /Terms/gi,
            /Locations/gi,
            /Language/gi
          ];

          for (const pattern of patternsToRemove) {
            caption = caption.replace(pattern, '');
          }

          caption = caption.replace(/\s+/g, ' ').trim();
        }

        console.log('  Caption length:', caption.length, 'characters');

        // Extract date
        const dateMatch = pageSource.match(/<time[^>]*datetime="([^"]+)"/);
        const postDate = dateMatch ? dateMatch[1] : null;
        console.log('  Post date:', postDate || 'N/A');

        // Extract image
        const imageMatch = pageSource.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/);
        const imageUrl = imageMatch ? imageMatch[1] : null;
        console.log('  Image:', imageUrl ? 'Found' : 'Not found');

        // Extract phone numbers and event info using regex
        console.log('→ Parsing caption with regex...');
        const regexResult = extractPhoneNumbers(caption);
        const phone1 = regexResult.phone1;
        const phone2 = regexResult.phone2;
        const phone3 = regexResult.phone3;
        const phone4 = regexResult.phone4;
        const allPhones = regexResult.allPhones;
        const eventTitle = parseEventTitle(caption);
        const eventOrganizer = parseOrganizer(caption);

        console.log('  Phone 1:', phone1 || 'None');
        console.log('  Phone 2:', phone2 || 'None');
        console.log('  Phone 3:', phone3 || 'None');
        console.log('  Phone 4:', phone4 || 'None');
        console.log('  Total phones found:', allPhones.length);

        const postData = {
          postIndex: actualIndex,
          postUrl,
          postDate: parsePostDate(postDate),
          eventTitle,
          eventOrganizer,
          phoneNumber1: phone1,
          phoneNumber2: phone2,
          phoneNumber3: phone3,
          phoneNumber4: phone4,
          allPhones: allPhones,
          imageUrl,
          caption
        };

        scrapedData.push(postData);
        appendPostToCsv(csvPath, sessionId, postData); // incremental save — survives crashes

        // Broadcast data to debug interface
        await broadcastDebugData('caption', { caption, postUrl });
        await broadcastDebugData('data', postData);

        scrapedCount++;
        if (allPhones.length > 0) {
          phoneCount++;
          console.log('✓ HAS PHONE NUMBER!');
        }

        // Random delay
        const delay = 2000 + Math.random() * 2000;
        console.log('→ Waiting', Math.round(delay/1000), 's...');
        await driver.sleep(delay);

      } catch (error) {
        console.error('✗ Failed to scrape post ' + (actualIndex + 1) + ':', error.message);
      }
    }

    console.log('\n=== Scraping Summary ===');
    console.log('Total posts processed:', postsToScrape.length);
    console.log('Successfully scraped:', scrapedCount);
    console.log('Posts with phone numbers:', phoneCount);
    console.log('');

    // Extract username from profile URL for backup (may not exist in direct post mode)
    const username = isDirectPost ? extractUsername(profileUrl) || 'unknown' : extractUsername(profileUrl);

    // Prepare JSON data structure
    const jsonData = {
      profileUrl,
      username,
      timestamp: new Date().toISOString(),
      startTime: new Date().toISOString(),
      posts: scrapedData,
      summary: {
        total: scrapedCount,
        withPhone: phoneCount,
        range: { start: startIndex, end: endIndex }
      }
    };

    // CSV was already written incrementally — just report completion
    console.log(`✓ CSV saved: ${csvFilename} (${scrapedCount} posts)`);

    console.log('\n=== Done! ===');
    console.log('\n📋 Next Steps (MASTER_RULE.md):');
    console.log('1. Read MASTER_RULE.md for complete workflow');
    console.log('2. Prompt Claude: "Read MASTER_RULE.md and parse the newest file in /parsed folder"');
    console.log('3. Claude will create JSON in /output folder');
    console.log('');

    return {
      sessionId,
      posts: scrapedData,
      summary: {
        total: scrapedCount,
        withPhone: phoneCount
      }
    };
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    throw error;
  } finally {
    if (driver) {
      console.log('→ Closing browser...');
      await driver.quit();
      console.log('✓ Browser closed');
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Instagram Scraper (Local)

Usage:
  node scraper.js <profile-url> [options]

Arguments:
  profile-url        Instagram profile URL (e.g., https://www.instagram.com/username/)

Options:
  --start INDEX       Start post index (default: 0)
  --end INDEX         End post index (default: 20)
  --auth              Use Instagram login (from .env)
  --headless          Run in headless mode (no window)
  --debug             Enable debug mode with screenshot streaming
  --session ID        Debug session ID for screenshot streaming
  --help, -h          Show this help

Examples:
  node scraper.js https://www.instagram.com/username/
  node scraper.js https://www.instagram.com/username/ --start 0 --end 50
  node scraper.js https://www.instagram.com/username/ --auth --headless
  node scraper.js https://www.instagram.com/username/ --debug --session debug-12345

Environment (.env):
  INSTAGRAM_USERNAME    Your Instagram username (for --auth)
  INSTAGRAM_PASSWORD    Your Instagram password (for --auth)
  VPS_API_TOKEN         JWT token for VPS API
`);
    process.exit(0);
  }

  const profileUrl = args[0];
  const startIndex = parseInt(args[args.indexOf('--start') + 1]) || DEFAULT_START_INDEX;
  const endIndex = parseInt(args[args.indexOf('--end') + 1]) || DEFAULT_END_INDEX;
  const useAuth = args.includes('--auth');
  const headless = args.includes('--headless');
  debugMode = args.includes('--debug');
  const sessionIndex = args.indexOf('--session');
  if (sessionIndex !== -1) {
    debugSessionId = args[sessionIndex + 1];
  }

  const instaUsername = process.env.INSTAGRAM_USERNAME;
  const instaPassword = process.env.INSTAGRAM_PASSWORD;

  if (useAuth && (!instaUsername || !instaPassword)) {
    console.error('✗ --auth requires INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD in .env');
    process.exit(1);
  }

  if (debugMode) {
    console.log('🐛 Debug mode enabled');
    console.log('🐛 Session ID:', debugSessionId || 'Not set');
  }

  try {
    await scrapeInstagram({
      profileUrl,
      startIndex,
      endIndex,
      useAuth,
      username: instaUsername,
      password: instaPassword,
      headless
    });
  } catch (error) {
    console.error('\n✗ Scraping failed:', error.message);
    process.exit(1);
  }
}

main();
