/**
 * Simple Single Instagram Post Scraper
 * Hardcoded Windows paths to avoid escaping issues
 */

import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import fs from 'fs';
import path from 'path';

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
async function extractCaption(driver, url) {
  console.log(`📖 Opening: ${url}`);

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
      console.log(`⚠ No caption found`);
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
  console.log('=== Single Instagram Post Scraper (Simple) ===');
  console.log('📝 Full Caption - No Character Limit');
  console.log('');

  const instagramUrl = process.argv[2];

  if (!instagramUrl) {
    console.error('❌ ERROR: Please provide Instagram URL');
    console.error('   Usage: node scrape-one-post-simple.js <instagram-url>');
    console.error('   Example: node scrape-one-post-simple.js https://www.instagram.com/infolomba/p/DUsHzUsj2NH/');
    process.exit(1);
  }

  console.log(`🚀 Starting Chrome driver...`);

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

    console.log(`🏃 Scraping caption...`);

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

      console.log('');
      console.log('💾 Generating CSV...');

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

      const increment = getNextIncrement();
      const csvFilename = `parsed#${increment}-${sessionId}-${timestamp}.csv`;
      const csvPath = PARSED_DIR + '\\' + csvFilename;

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
      console.log('🎯 Next step: Ask Claude to parse per MASTER_RULE.md');

    } else {
      console.log('❌ No caption found');
      console.log('   Tip: Make sure you are logged into Instagram');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    console.error('Please make sure Chrome is installed:');
    console.error('  Download: https://www.google.com/chrome/');
    process.exit(1);
  } finally {
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
