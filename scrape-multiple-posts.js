/**
 * Multiple Instagram Posts Scraper - From JSON File
 *
 * Reads a JSON file of URLs and scrapes each one
 * Extracts FULL captions (no character limit)
 * Saves to CSV in /parsed folder
 *
 * USAGE:
 * node scrape-multiple-posts.js <path-to-json-file.json>
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';

// Configuration
const PAGE_WAIT_MS = 5000;
const CAPTION_WAIT_MS = 5000;

// Hardcoded paths for Windows
const PROJECT_DIR = 'D:\\Hilmi\\Coding\\WebScraper';
const PARSED_DIR = 'D:\\Hilmi\\Coding\\WebScraper\\parsed';

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
async function extractCaption(driver, url, postIndex) {
  console.log(`📖 Opening post ${postIndex + 1}: ${url}`);

  try {
    await driver.get(url);
    console.log(`⏳ Waiting for page load...`);
    await driver.sleep(PAGE_WAIT_MS);

    console.log(`🔍 Looking for caption...`);

    let caption = '';

    const selectors = [
      'h1',
      'div[data-testid="post-comment-root"]',
      'span[dir="auto"]',
      'article div span',
      'article h1'
    ];

    for (const selector of selectors) {
      try {
        const elements = await driver.findElements(By.css(selector));
        console.log(`   Trying: ${selector} - ${elements.length} elements`);

        for (const element of elements) {
          try {
            const text = await element.getText();
            if (text && text.length > caption.length) {
              caption = text;
              console.log(`   ✓ Better caption (${text.length} chars)`);
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    if (!caption) {
      console.log(`🔄 Trying all page text...`);
      try {
        const body = await driver.findElement(By.css('body'));
        const pageText = await body.getText();
        const lines = pageText.split('\n');
        const textBlocks = lines.filter(t => t.length > 30);

        if (textBlocks.length > 0) {
          textBlocks.sort((a, b) => b.length - a.length);
          caption = textBlocks[0].trim();
          console.log(`   ✓ Caption from page text (${caption.length} chars)`);
        } else if (pageText && pageText.length > 20) {
          caption = pageText.trim();
          console.log(`   ✓ Using all text (${caption.length} chars)`);
        }
      } catch (e) {
        console.log(`   ✗ Failed: ${e.message}`);
      }
    }

    caption = caption.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();

    if (!caption) {
      console.log(`⚠ No caption found for post ${postIndex + 1}`);
      return '';
    }

    console.log(`📄 Caption length: ${caption.length} chars`);
    return caption;

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    return '';
  }
}

// Generate CSV content
function generateCSV(posts) {
  const headers = 'session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited';

  let csv = headers + '\n';

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

// Get next increment number
function getNextIncrement() {
  try {
    const files = fs.readdirSync(PARSED_DIR);
    const increments = files
      .filter(f => f.match(/^(example_)?parsed#(\d+)-.*\.csv$/))
      .map(f => {
        const match = f.match(/parsed#(\d+)-/);
        return match ? parseInt(match[1]) : 0;
      });
    return increments.length > 0 ? Math.max(...increments) + 1 : 1;
  } catch (e) {
    console.log(`   Warning: Could not read parsed directory: ${e.message}`);
    return 1;
  }
}

// Main scraping function
async function main() {
  console.log('=== Multiple Instagram Posts Scraper ===');
  console.log('📝 Full Captions - From JSON File');
  console.log('');

  // Get JSON file path from command line
  const jsonFilePath = process.argv[2];

  if (!jsonFilePath) {
    console.error('❌ ERROR: Please provide JSON file path');
    console.error('   Usage: node scrape-multiple-posts.js <path-to-json-file.json>');
    console.error('');
    console.error('   Example: node scrape-multiple-posts.js collected_link/post-urls-infolomba-1772781417966.json');
    console.error('   Or: node scrape-multiple-posts.js post-urls.json (if in same folder)');
    process.exit(1);
  }

  console.log(`📂 Reading JSON file: ${jsonFilePath}`);

  // Read JSON file
  let jsonData;
  try {
    const content = fs.readFileSync(jsonFilePath, 'utf8');
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

    const sessionId = generateSessionId();
    const timestamp = Date.now();
    const scrapedPosts = [];

    console.log(`🏃 Starting to scrape ${posts.length} posts...`);
    console.log('');

    // Scrape each post
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const percent = Math.round(((i + 1) / posts.length) * 100);

      console.log('');
      console.log(`[ ${i + 1}/${posts.length} ] ${percent}% | Post #${post.index}`);
      console.log(`  URL: ${post.url}`);

      // Extract caption
      const caption = await extractCaption(driver, post.url, post.index);

      if (caption.length > 0) {
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
          parse_status: 'pending',
          parse_timestamp: new Date().toISOString(),
          last_edited: ''
        };

        scrapedPosts.push(postData);

        // Small delay between posts
        await driver.sleep(500);
      }

      // Save progress every 5 posts
      if ((i + 1) % 5 === 0) {
        console.log('');
        console.log(`💾 Saving progress...`);

        // Create CSV with posts scraped so far
        const csvContent = generateCSV(scrapedPosts);

        // Save to file
        const increment = getNextIncrement();
        const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
        const csvPath = PARSED_DIR + '\\' + csvFilename;

        try {
          fs.writeFileSync(csvPath, csvContent, 'utf8');
          console.log(`✓ Progress saved to: ${csvPath}`);
          console.log(`  Posts: ${scrapedPosts.length}`);
        } catch (e) {
          console.log(`   ⚠ Could not save progress: ${e.message}`);
        }
      }
    }

    console.log('');
    console.log('✓ All posts scraped!');
    console.log(`  Total: ${scrapedPosts.length} posts`);
    console.log(`  Successful: ${scrapedPosts.filter(p => p.original_caption && p.original_caption.length > 0).length}`);

    // Generate final CSV
    console.log('');
    console.log('💾 Generating CSV...');
    console.log('');

    const csvContent = generateCSV(scrapedPosts);

    // Create parsed directory if it doesn't exist
    try {
      if (!fs.existsSync(PARSED_DIR)) {
        fs.mkdirSync(PARSED_DIR, { recursive: true });
        console.log(`📁 Created parsed directory`);
      }
    } catch (e) {
      console.log(`   Warning: Could not create parsed directory: ${e.message}`);
    }

    // Get next increment number
    const increment = getNextIncrement();
    const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
    const csvPath = PARSED_DIR + '\\' + csvFilename;

    fs.writeFileSync(csvPath, csvContent, 'utf8');

    console.log(`✓ CSV saved to: ${csvPath}`);
    console.log(`  Session ID: ${sessionId}`);
    console.log(`  Increment: ${increment}`);
    console.log(`  Posts saved: ${scrapedPosts.length}`);
    console.log('');
    console.log('===========================================');
    console.log('✅ SCRAPING COMPLETE!');
    console.log('===========================================');
    console.log('');
    console.log('📂 CSV File:');
    console.log(`  ${csvPath}`);
    console.log('');
    console.log('🎯 Next step: Ask Claude to parse per MASTER_RULE.md');
    console.log('');
    console.log('   Prompt: "Read MASTER_RULE.md and parse newest file in /parsed folder"');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR during scraping:', error.message);
    console.error('');

    // Save partial results if any
    if (scrapedPosts.length > 0) {
      console.log('💾 Saving partial results...');
      const csvContent = generateCSV(scrapedPosts);
      const increment = getNextIncrement();
      const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
      const csvPath = PARSED_DIR + '\\' + csvFilename;
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

main().catch(error => {
  console.error('❌ FATAL ERROR:', error);
  process.exit(1);
});
