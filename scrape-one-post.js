/**
 * Single Instagram Post Scraper - Full Caption
 *
 * Opens a single Instagram URL and extracts the FULL caption
 * Saves to CSV in /parsed folder
 *
 * USAGE:
 * node scrape-one-post.js <instagram-url>
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';

const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

// Configuration
const PAGE_WAIT_MS = 5000;
const CAPTION_WAIT_MS = 5000;

// Generate session ID
function generateSessionId() {
  return Date.now().toString(36).substring(0, 8) + Math.random().toString(36).substring(2, 6);
}

// Escape CSV value
function escapeCSV(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Extract FULL caption from Instagram post page
async function extractCaption(driver, url) {
  console.log(`📖 Opening: ${url}`);

  try {
    // Navigate to post
    await driver.get(url);

    // Wait for page to load
    console.log(`⏳ Waiting for page load...`);
    await driver.sleep(PAGE_WAIT_MS);

    console.log(`🔍 Looking for caption...`);

    let caption = '';

    // Try multiple selectors to find caption
    const selectors = [
      'h1',
      'div[data-testid="post-comment-root"]',
      'span[dir="auto"]',
      'article div span',
      'article h1',
      'div[role="button"] span',
      'span[role="text"]'
    ];

    for (const selector of selectors) {
      try {
        const elements = await driver.findElements(By.css(selector));
        console.log(`   Trying selector: ${selector} - Found ${elements.length} elements`);

        for (const element of elements) {
          try {
            const text = await element.getText();
            // Find the longest, most complete caption
            if (text && text.length > 10) {
              if (text.length > caption.length) {
                caption = text;
                console.log(`   ✓ Found better caption (${text.length} chars)`);
              }
            }
          } catch (e) {}
        }
      } catch (e) {
        console.log(`   ✗ Selector ${selector} failed: ${e.message}`);
      }
    }

    // If no caption found with selectors, try to get ALL page text
    if (!caption || caption.length < 20) {
      console.log(`🔄 Trying alternative method (all page text)...`);
      try {
        const body = await driver.findElement(By.css('body'));
        const pageText = await body.getText();

        // Find the longest text block that looks like a caption
        const lines = pageText.split('\n');
        const textBlocks = lines.filter(t => t.length > 30);

        if (textBlocks.length > 0) {
          // Sort by length and get the longest
          textBlocks.sort((a, b) => b.length - a.length);
          caption = textBlocks[0].trim();
          console.log(`   ✓ Caption extracted from page text (${caption.length} chars)`);
        } else if (pageText && pageText.length > 20) {
          caption = pageText.trim();
          console.log(`   ✓ Using all page text (${caption.length} chars)`);
        }
      } catch (e) {
        console.log(`   ✗ Alternative method failed: ${e.message}`);
      }
    }

    // Clean up the caption (remove excessive whitespace but preserve newlines)
    caption = caption
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();

    if (!caption) {
      console.log(`⚠ No caption found for: ${url}`);
      return '';
    }

    console.log(`📄 Caption length: ${caption.length} chars`);
    console.log(`📋 Caption preview (first 200 chars):`);
    console.log(caption.substring(0, 200) + (caption.length > 200 ? '...' : ''));

    return caption;

  } catch (error) {
    console.error(`✗ Error extracting caption from ${url}:`, error.message);
    return '';
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
      escapeCSV(post.original_caption), // FULL caption, no limit
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

// Main scraping function
async function main() {
  console.log('=== Single Instagram Post Scraper ===');
  console.log('📝 Scrapes FULL caption (no character limit)');
  console.log('');

  // Get Instagram URL from command line
  const instagramUrl = process.argv[2];

  if (!instagramUrl) {
    console.error('❌ ERROR: Please provide Instagram URL');
    console.error('   Usage: node scrape-one-post.js <instagram-post-url>');
    console.error('');
    console.error('   Example: node scrape-one-post.js https://www.instagram.com/infolomba/p/DUsHzUsj2NH/');
    process.exit(1);
  }

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
    console.log(`📍 Target: ${instagramUrl}`);
    console.log('');

    const sessionId = generateSessionId();
    const timestamp = Date.now();
    const scrapedPosts = [];

    // Extract caption
    console.log(`🏃 Scraping caption...`);
    console.log('');

    const caption = await extractCaption(driver, instagramUrl);

    if (caption.length > 0) {
      const postData = {
        session_id: sessionId,
        json_file: '',
        post_index: 0,
        post_url: instagramUrl,
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

      scrapedPosts.push(postData);

      // Generate CSV content
      console.log('');
      console.log('💾 Generating CSV...');
      console.log('');

      const csvContent = generateCSV(scrapedPosts);

      // Save CSV to /parsed folder
      const parsedDir = path.join(__dirname, 'parsed');

      // Use path.resolve for better Windows path handling
      const parsedDirResolved = path.resolve(__dirname, 'parsed');

      if (!fs.existsSync(parsedDirResolved)) {
        console.log(`📁 Creating parsed folder: ${parsedDirResolved}`);
        fs.mkdirSync(parsedDirResolved, { recursive: true });
      }

      // Get next increment number (use resolved path)
      const files = fs.readdirSync(parsedDirResolved);
      const increments = files
        .filter(f => f.match(/^(example_)?parsed#(\d+)-.*\.csv$/))
        .map(f => {
          const match = f.match(/parsed#(\d+)-/);
          return match ? parseInt(match[1]) : 0;
        });
      const increment = increments.length > 0 ? Math.max(...increments) + 1 : 1;

      // Create CSV filename
      const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
      const csvPath = path.join(parsedDir, csvFilename);

      fs.writeFileSync(csvPath, csvContent, 'utf8');

      console.log(`✓ CSV saved to: ${csvPath}`);
      console.log(`  Session ID: ${sessionId}`);
      console.log(`  Increment: ${increment}`);
      console.log(`  Posts saved: 1`);
      console.log('');
      console.log('===========================================');
      console.log('✅ SCRAPING COMPLETE!');
      console.log('===========================================');
      console.log('');
      console.log('📂 CSV File:');
      console.log(`  ${csvPath}`);
      console.log('');
      console.log('🎯 Next step: Ask Claude to parse the CSV per MASTER_RULE.md');
      console.log('');

    } else {
      console.log('❌ No caption found');
      console.log('');
      console.log('💡 Tip: Make sure you are logged into Instagram');
      console.log('💡 Tip: Try opening the post manually first to verify it loads');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    console.error('Please make sure Chrome is installed:');
    console.error('  Download: https://www.google.com/chrome/');
    process.exit(1);
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

// Run the scraper
main().catch(error => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});
