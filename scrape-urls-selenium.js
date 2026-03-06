/**
 * Instagram URLs to CSV Scraper - Selenium Automation
 *
 * Reads a JSON file of URLs and scrapes each one using Selenium
 * Automatically navigates to each URL and extracts caption
 * Saves to /parsed folder in CSV format
 *
 * USAGE:
 * node scrape-urls-selenium.js path/to/your-json-file.json
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// Configuration
const POST_WAIT_MS = 5000;
const CAPTION_WAIT_MS = 3000;

// Generate session ID
function generateSessionId() {
  return Date.now().toString(36).substring(0, 8) + Math.random().toString(36).substring(2, 6);
}

// Escape CSV value
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Extract caption from Instagram post page
async function extractCaption(driver, url) {
  console.log(`  📖 Opening: ${url}`);

  try {
    // Navigate to post
    await driver.get(url);

    // Wait for page to load
    console.log(`  ⏳ Waiting for page load...`);
    await driver.sleep(CAPTION_WAIT_MS);

    // Wait for caption to be present
    console.log(`  🔍 Looking for caption...`);
    let caption = '';

    // Try multiple selectors to find caption
    const selectors = [
      'h1',
      'div[data-testid="post-comment-root"]',
      'span[dir="auto"]',
      'article div span'
    ];

    for (const selector of selectors) {
      try {
        const elements = await driver.findElements(By.css(selector));

        for (const element of elements) {
          try {
            const text = await element.getText();
            // Find longest meaningful text (captions are usually > 20 chars)
            if (text && text.length > 20) {
              caption = text;
              console.log(`  ✓ Caption found via selector: ${selector}`);
              break;
            }
          } catch (e) {}
        }
        if (caption) break;
      } catch (e) {
        console.log(`  ✗ Selector ${selector} failed: ${e.message}`);
      }
    }

    // If no caption found with selectors, try to get all page text
    if (!caption || caption.length < 20) {
      console.log(`  🔄 Trying alternative method...`);
      try {
        const body = await driver.findElement(By.css('body'));
        const pageText = await body.getText();

        // Find longest text block that might be caption
        const textBlocks = pageText.split('\n').filter(t => t.length > 50);
        if (textBlocks.length > 0) {
          caption = textBlocks[0].trim();
          console.log(`  ✓ Caption extracted from page text`);
        } else if (pageText && pageText.length > 20) {
          caption = pageText.substring(0, 5000);
          console.log(`  ✓ Using first 5000 chars of page text`);
        }
      } catch (e) {
        console.log(`  ✗ Alternative method failed: ${e.message}`);
      }
    }

    // Clean up the caption (remove excessive whitespace)
    caption = caption
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    if (!caption) {
      console.log(`  ⚠ No caption found for: ${url}`);
      return '';
    }

    console.log(`  📄 Caption length: ${caption.length} chars`);
    return caption;

  } catch (error) {
    console.error(`  ✗ Error extracting caption from ${url}:`, error.message);
    return '';
  }
}

// Main scraping function
async function main() {
  console.log('=== Instagram URLs to CSV Scraper - Selenium ===');
  console.log('');

  // Get JSON file path from command line
  const jsonFilePath = process.argv[2];

  if (!jsonFilePath) {
    console.error('❌ ERROR: Please provide JSON file path');
    console.error('   Usage: node scrape-urls-selenium.js <path-to-json-file.json>');
    console.error('');
    console.error('   Example: node scrape-urls-selenium.js public/post-urls-infolomba-123456.json');
    console.error('   Or: node scrape-urls-selenium.js post-urls.json (if in same folder)');
    process.exit(1);
  }

  // Resolve path
  const resolvedPath = path.resolve(jsonFilePath);

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ ERROR: JSON file not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`📂 Reading JSON file: ${resolvedPath}`);

  // Read JSON file
  let jsonData;
  try {
    const content = fs.readFileSync(resolvedPath, 'utf8');
    jsonData = JSON.parse(content);
  } catch (error) {
    console.error(`❌ ERROR: Failed to parse JSON file: ${error.message}`);
    process.exit(1);
  }

  // Extract metadata and posts
  const metadata = jsonData.metadata || {};
  const posts = jsonData.posts || [];

  if (posts.length === 0) {
    console.error('❌ ERROR: No posts found in JSON file');
    process.exit(1);
  }

  console.log(`📋 Metadata:`);
  console.log(`  Username: ${metadata.targetUsername || 'unknown'}`);
  console.log(`  Posts: ${metadata.collectedCount || metadata.totalPostsLoaded || posts.length}`);
  console.log('');

  // Get next increment number (function defined outside try/catch)
  const getNextIncrement = () => {
    const parsedDir = path.join(__dirname, 'parsed');
    if (!fs.existsSync(parsedDir)) {
      return 1;
    }
    const files = fs.readdirSync(parsedDir);
    const increments = files
      .filter(f => f.match(/^(example_)?parsed#(\d+)-.*\.csv$/))
      .map(f => {
        const match = f.match(/parsed#(\d+)-/);
        return match ? parseInt(match[1]) : 0;
      });
    return increments.length > 0 ? Math.max(...increments) + 1 : 1;
  };

  // Initialize Selenium driver
  console.log(`🚀 Starting Chrome driver...`);
  console.log('');

  let driver;
  try {
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(
        new chrome.Options()
          .addArguments('--disable-blink-features=AutomationControlled')
          .addArguments('--disable-dev-shm-usage')
      )
      .build();

    console.log('✓ Chrome driver started');
    console.log('');

  } catch (error) {
    console.error('❌ ERROR: Failed to start Chrome driver:', error.message);
    console.error('');
    console.error('Please make sure Chrome is installed:');
    console.error('  Download: https://www.google.com/chrome/');
    process.exit(1);
  }

  const sessionId = generateSessionId();
  const timestamp = Date.now();
  const scrapedPosts = [];

  console.log(`🏃 Starting to scrape ${posts.length} posts...`);
  console.log('');

  try {
    // Scrape each post
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const percent = Math.round(((i + 1) / posts.length) * 100);

      console.log('');
      console.log(`[ ${i + 1}/${posts.length} ] ${percent}% | Post #${post.index}`);
      console.log(`  URL: ${post.url}`);

      // Extract caption
      const caption = await extractCaption(driver, post.url);

      const postData = {
        session_id: sessionId,
        json_file: '',
        post_index: post.index,
        post_url: post.url,
        original_caption: caption,
        extracted_title: '',
        extracted_organizer: '',
        extracted_date: '',
        extracted_location: '',
        registration_fee: '',
        phone_numbers: '',
        contact_persons: '',
        parse_status: caption.length > 0 ? 'pending' : 'error',
        parse_timestamp: new Date().toISOString(),
        last_edited: ''
      };

      scrapedPosts.push(postData);

      // Small delay between posts
      await driver.sleep(1000);

      // Save progress every 5 posts
      if ((i + 1) % 5 === 0) {
        console.log(`  💾 Saving progress...`);
        saveProgress(posts.length, i + 1, scrapedPosts);
      }
    }

    console.log('');
    console.log('✓ All posts scraped!');
    console.log(`  Total: ${scrapedPosts.length} posts`);

    // Generate CSV content
    console.log('');
    console.log('💾 Generating CSV...');
    console.log('');

    const csvContent = generateCSV(scrapedPosts);

    // Save CSV to /parsed folder
    const parsedDir = path.join(__dirname, 'parsed');
    if (!fs.existsSync(parsedDir)) {
      fs.mkdirSync(parsedDir, { recursive: true });
    }

    // Get next increment number
    const increment = getNextIncrement();

    // Create CSV filename
    const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
    const csvPath = path.join(parsedDir, csvFilename);

    fs.writeFileSync(csvPath, csvContent, 'utf8');

    console.log(`✓ CSV saved to: ${csvPath}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log(`  Increment: ${getNextIncrement()}`);
    console.log(`  Posts saved: ${scrapedPosts.length}`);
    console.log('');

    // Show success message
    console.log('===========================================');
    console.log('✅ SCRAPING COMPLETE!');
    console.log('===========================================');
    console.log('');
    console.log('📂 CSV File:');
    console.log(`  ${csvPath}`);
    console.log('');
    console.log('🎯 Next step: Ask Claude to parse the CSV per MASTER_RULE.md');
    console.log('');
    console.log('   Prompt: "Read MASTER_RULE.md and parse the newest file in /parsed folder"');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR during scraping:', error.message);
    console.error('');

    // Save whatever was scraped so far
    if (scrapedPosts.length > 0) {
      console.log('💾 Saving partial results...');
      const csvContent = generateCSV(scrapedPosts);
      const parsedDir = path.join(__dirname, 'parsed');
      if (!fs.existsSync(parsedDir)) {
        fs.mkdirSync(parsedDir, { recursive: true });
      }
      const increment = getNextIncrement();
      const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
      const csvPath = path.join(parsedDir, csvFilename);
      fs.writeFileSync(csvPath, csvContent, 'utf8');
      console.log(`✓ Partial CSV saved to: ${csvPath}`);
    }
  } finally {
    // Always close driver
    if (driver) {
      console.log('');
      console.log('🚪 Closing Chrome driver...');
      await driver.quit();
      console.log('✓ Driver closed');
    }
  }
}

// Generate CSV content
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
      escapeCSV(post.original_caption.substring(0, 5000)), // Limit to 5000 chars
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

// Save progress to temporary file
function saveProgress(total, current, posts) {
  try {
    const progressData = {
      sessionId: generateSessionId(),
      total,
      current,
      timestamp: new Date().toISOString(),
      posts: posts.map(p => ({
        index: p.post_index,
        url: p.post_url,
        hasCaption: (p.original_caption || '').length > 0
      }))
    };
    const progressFile = path.join(__dirname, 'scrape-progress.json');
    fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
  } catch (e) {
    console.log(`  ⚠ Could not save progress: ${e.message}`);
  }
}

// Run the scraper
main().catch(error => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});
