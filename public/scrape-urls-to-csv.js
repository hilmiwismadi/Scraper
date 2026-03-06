/**
 * Instagram URL Scraper to CSV - Scrapes URLs from JSON to Parsed Folder
 *
 * This script:
 * 1. Reads a JSON file containing post URLs (from collect-post-urls.js)
 * 2. Opens each URL in Instagram
 * 3. Extracts the caption
 * 4. Saves to /parsed folder in CSV format (ready for Claude LLM)
 *
 * INSTRUCTIONS:
 * 1. Open Instagram in Chrome, navigate to target profile (stay on profile page)
 * 2. Open this script file in a new tab: http://localhost:3003/scrape-urls-to-csv.js
 * 3. Copy the entire script
 * 4. Open a file input dialog (click "Upload JSON" button below)
 * 5. Select your JSON file (e.g., post-urls-infolomba-1772781417966.json)
 * 6. Script will scrape each URL and create CSV
 */

(function() {
  'use strict';

  const POST_WAIT_MS = 3000;
  const SERVER_URL = 'http://localhost:3003';

  // State
  let targetUsername = '';
  let jsonData = null;
  const scrapedPosts = [];
  const sessionId = generateSessionId();

  function log(message, ...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`, ...args);
  }

  function processTitle(text) {
    document.title = text;
  }

  function generateSessionId() {
    return Date.now().toString(36).substring(0, 8) + Math.random().toString(36).substring(2, 6);
  }

  function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Scrape a single post URL and extract caption
  async function scrapePostUrl(postUrl, index) {
    log(`Scraping post ${index + 1}/${jsonData.metadata.collectedCount}: ${postUrl.substring(postUrl.length - 25)}...`);

    // Save current page URL (should be profile page)
    const profileUrl = window.location.href;

    try {
      // Navigate to post
      window.location.href = postUrl;
      await sleep(POST_WAIT_MS);

      // Wait additional time for content to load
      await sleep(2000);

      // Extract caption from page
      let caption = '';

      const captionSelectors = [
        'h1',
        'div[data-testid="post-comment-root"]',
        'span[dir="auto"]',
        'article div span',
        'article h1'
      ];

      for (const selector of captionSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.innerText || el.textContent;
            // Look for longer text (captions are usually > 20 chars)
            if (text && text.length > 20) {
              caption = text;
              break;
            }
          }
          if (caption) break;
        } catch (e) {}
      }

      // If no caption found, try alternative method - get all text and find longest
      if (!caption || caption.length < 20) {
        try {
          const pageText = document.body.innerText;
          // Find the longest text block that looks like a caption
          const textBlocks = pageText.split('\n').filter(t => t.length > 50);
          if (textBlocks.length > 0) {
            // Get the first meaningful block (usually caption is first significant text)
            caption = textBlocks[0].trim();
          }
        } catch (e) {
          log('  Warning: Could not extract caption with alternative method');
        }
      }

      // If still no caption, get whatever text we can find
      if (!caption) {
        try {
          const allText = document.body.innerText;
          if (allText && allText.length > 10) {
            caption = allText.substring(0, 5000); // Limit to 5000 chars
          }
        } catch (e) {}
      }

      const postData = {
        session_id: sessionId,
        json_file: '',
        post_index: index,
        post_url: postUrl,
        original_caption: caption,
        extracted_title: '',
        extracted_organizer: '',
        extracted_date: '',
        extracted_location: '',
        registration_fee: '',
        phone_numbers: '',
        contact_persons: '',
        parse_status: 'pending',
        parse_timestamp: new Date().toISOString(),
        last_edited: ''
      };

      log(`  ✓ Caption extracted (${caption.substring(0, 50)}...)`);

      // Return to profile page before next post
      window.location.href = profileUrl;
      await sleep(2000);

      return postData;

    } catch (error) {
      log(`  ✗ Error scraping post: ${error.message}`);

      // Try to return to profile page
      try {
        window.location.href = profileUrl;
        await sleep(2000);
      } catch (e) {}

      return {
        session_id: sessionId,
        json_file: '',
        post_index: index,
        post_url: postUrl,
        original_caption: '',
        extracted_title: '',
        extracted_organizer: '',
        extracted_date: '',
        extracted_location: '',
        registration_fee: '',
        phone_numbers: '',
        contact_persons: '',
        parse_status: 'error',
        parse_timestamp: new Date().toISOString(),
        last_edited: '',
        error: error.message
      };
    }
  }

  // Generate CSV content from scraped posts
  function generateCSV(posts) {
    const headers = [
      'session_id',
      'json_file',
      'post_index',
      'post_url',
      'original_caption',
      'extracted_title',
      'extracted_organizer',
      'extracted_date',
      'extracted_location',
      'registration_fee',
      'phone_numbers',
      'contact_persons',
      'parse_status',
      'parse_timestamp',
      'last_edited'
    ];

    let csv = headers.join(',') + '\n';

    posts.forEach(post => {
      csv += [
        escapeCSV(post.session_id),
        escapeCSV(post.json_file),
        escapeCSV(post.post_index),
        escapeCSV(post.post_url),
        escapeCSV(post.original_caption),
        escapeCSV(post.extracted_title),
        escapeCSV(post.extracted_organizer),
        escapeCSV(post.extracted_date),
        escapeCSV(post.extracted_location),
        escapeCSV(post.registration_fee),
        escapeCSV(post.phone_numbers),
        escapeCSV(post.contact_persons),
        escapeCSV(post.parse_status),
        escapeCSV(post.parse_timestamp),
        escapeCSV(post.last_edited)
      ].join(',') + '\n';
    });

    return csv;
  }

  // Download CSV file
  function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Save to server /parsed folder
  async function saveToServer(csvContent, filename) {
    try {
      const response = await fetch(`${SERVER_URL}/api/browser-scraper/save-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent: csvContent,
          filename: filename,
          sessionId: sessionId
        })
      });

      if (response.ok) {
        const data = await response.json();
        log(`✓ CSV saved to /parsed/${data.filename}`);
        log(`  Session ID: ${data.sessionId}`);
        log(`  Posts saved: ${data.postsSaved}`);
        return true;
      } else {
        const errorText = await response.text();
        log(`⚠ Could not save to /parsed folder: ${errorText}`);
        return false;
      }
    } catch (error) {
      log(`⚠ Could not connect to server: ${error.message}`);
      log('   Make sure server is running (npm start)');
      return false;
    }
  }

  function showSummary(posts) {
    log('');
    log('📊 Scraping Summary:');

    let successCount = 0;
    let errorCount = 0;
    let emptyCaptionCount = 0;

    posts.forEach(post => {
      if (post.parse_status === 'error') {
        errorCount++;
      } else if (!post.original_caption || post.original_caption.length < 10) {
        emptyCaptionCount++;
      } else {
        successCount++;
      }
    });

    log(`  Total posts: ${posts.length}`);
    log(`  Successfully scraped: ${successCount}`);
    log(`  Empty/short captions: ${emptyCaptionCount}`);
    log(`  Errors: ${errorCount}`);
  }

  // Main scraping process
  async function scrapeAllUrls() {
    const posts = jsonData.posts || [];
    log(`🚀 Starting to scrape ${posts.length} posts...`);
    log('');

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      processTitle(`Scraping ${i + 1}/${posts.length} | Post ${post.index}`);

      const postData = await scrapePostUrl(post.url, post.index);
      scrapedPosts.push(postData);

      // Save progress every 5 posts
      if ((i + 1) % 5 === 0) {
        log(`Progress: ${i + 1}/${posts.length} posts completed`);
      }

      // Small delay between posts
      await sleep(500);
    }

    log('');
    log('✓ Scraping complete!');
    showSummary(scrapedPosts);
  }

  function main() {
    log('=== Instagram URL to CSV Scraper ===');
    log('📥 Reads JSON URLs, scrapes captions, saves to CSV');
    log('');

    // Create UI for file upload
    const container = document.createElement('div');
    container.id = 'csv-scraper-ui';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 400px;
    `;

    container.innerHTML = `
      <h3 style="margin:0 0 15px 0;color:#667eea;">📥 Upload JSON File</h3>
      <p style="margin:0 0 10px 0;color:#666;font-size:14px;">Select the JSON file from <code>collect-post-urls.js</code></p>
      <input type="file" id="jsonFileInput" accept=".json" style="
        width: 100%;
        padding: 10px;
        border: 2px solid #ddd;
        border-radius: 5px;
        font-size: 14px;
        margin-bottom: 10px;
      ">
      <button id="startScrapingBtn" style="
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 5px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
      ">🚀 Start Scraping</button>
      <button id="closeBtn" style="
        width: 100%;
        padding: 12px;
        background: #f0f0f0;
        color: #333;
        border: none;
        border-radius: 5px;
        font-size: 14px;
        cursor: pointer;
        margin-top: 10px;
      ">✖ Close</button>
    `;

    document.body.appendChild(container);

    // Handle file upload
    const fileInput = document.getElementById('jsonFileInput');
    const startBtn = document.getElementById('startScrapingBtn');
    const closeBtn = document.getElementById('closeBtn');

    let isScraping = false;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        jsonData = JSON.parse(text);

        log('');
        log('📋 JSON File Loaded:');
        log(`  Username: ${jsonData.metadata?.targetUsername || 'unknown'}`);
        log(`  Total posts: ${jsonData.metadata?.collectedCount || jsonData.posts?.length || 0}`);
        log(`  Filename: ${file.name}`);
        log('');

        // Get username from JSON metadata if available
        if (jsonData.metadata?.targetUsername) {
          targetUsername = jsonData.metadata.targetUsername;
        }

      } catch (error) {
        log('❌ Error reading JSON file:', error.message);
        alert('Failed to read JSON file. Please check the file format.');
        return;
      }
    });

    startBtn.addEventListener('click', async () => {
      if (!jsonData) {
        alert('Please upload a JSON file first!');
        return;
      }

      if (isScraping) {
        alert('Scraping is already in progress...');
        return;
      }

      isScraping = true;
      startBtn.disabled = true;
      startBtn.textContent = '⏳ Scraping...';
      closeBtn.disabled = true;

      try {
        await scrapeAllUrls();

        // Generate CSV
        const csvContent = generateCSV(scrapedPosts);

        // Generate filename
        const timestamp = Date.now();
        // Get increment from server
        try {
          const incrementResponse = await fetch(`${SERVER_URL}/api/browser-scraper/increment`);
          if (incrementResponse.ok) {
            const incrementData = await incrementResponse.json();
            const increment = incrementData.increment || 0;
            const filename = `example_parsed#${increment}-${sessionId}-${timestamp}.csv`;

            log('');
            log('💾 Saving CSV file...');

            // Save to server
            const serverSaved = await saveToServer(csvContent, filename);

            // Also download locally
            downloadCSV(csvContent, filename);

            log('');
            log('✅ Done!');
            log('📂 CSV saved to:');
            log(`   - /parsed/${filename} (server)`);
            log(`   - Downloaded to browser`);
            log('');
            log('🎯 Next step: Ask Claude to parse per MASTER_RULE.md');

          } else {
            throw new Error('Failed to get increment from server');
          }
        } catch (error) {
          // If server fails, just download locally
          const filename = `example_parsed_${sessionId}-${timestamp}.csv`;
          downloadCSV(csvContent, filename);
          log('');
          log('✅ Done! CSV downloaded to browser');
          log('⚠ Could not save to /parsed folder - check server');
        }

      } catch (error) {
        log('❌ Error during scraping:', error.message);
      } finally {
        isScraping = false;
        startBtn.disabled = false;
        startBtn.textContent = '🚀 Start Scraping';
        closeBtn.disabled = false;
      }
    });

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(container);
      log('❌ UI closed by user');
    });
  }

  // Run
  main().catch(error => {
    console.error('Fatal error:', error);
  });

})();
