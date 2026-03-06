/**
 * Instagram Browser-Based Scraper - REVERSE MODE ONLY (No Scroll)
 *
 * This script runs AFTER you've already scrolled using browser-scroller.js
 * It simply scrapes the last N posts going UPWARD from what's loaded on the page.
 *
 * INSTRUCTIONS:
 * 1. First, run browser-scroller.js to scroll and load posts
 * 2. DO NOT refresh the page
 * 3. Run this script in the same console
 * 4. It will scrape last N posts from what's already loaded
 * 5. View results at: file:///D:/Hilmi/Coding/WebScraper/public/scraper-results.html
 */

(function() {
  'use strict';

  // Configuration
  const POST_WAIT_MS = 2000;

  // State
  let postsToScrapeFromEnd = 10;
  let targetUsername = '';
  const collectedUrls = [];
  const scrapedPosts = [];
  const diagnosticLog = [];

  // Storage key for results
  const STORAGE_KEY = 'instagram_scraper_results_' + Date.now();

  function log(message, ...args) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${message}`, ...args);
  }

  function processTitle(text) {
    document.title = text;
  }

  function getPostLinks() {
    const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
    const seen = new Set();
    return links
      .map(a => a.href)
      .filter(href => {
        if (!href || !href.includes('/p/')) return false;
        // Extract unique post ID
        const match = href.match(/\/p\/([^\/]+)/);
        if (!match) return false;
        const postId = match[1];
        if (seen.has(postId)) return false;
        seen.add(postId);
        return true;
      });
  }

  async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function extractPhoneNumbers(text) {
    if (!text) return [];

    const phones = new Set();

    // Indonesian phone patterns
    const patterns = [
      /(\+62|62|0)[0-9]{8,12}/g,
      /(\+62|62|0)?[0-9]{3,4}-[0-9]{4}-[0-9]{4}/g,
      /(\+62|62|0)?[0-9]{3,4}\s[0-9]{4}\s[0-9]{4}/g
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(phone => {
          const clean = phone.replace(/[\s-]/g, '');
          phones.add(clean);
        });
      }
    });

    return Array.from(phones);
  }

  function extractEmails(text) {
    if (!text) return [];
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailPattern);
    return matches || [];
  }

  // Scrape a post by navigating to it and extracting data
  async function scrapePostData(postUrl, index) {
    log(`Scraping post index ${index}: ${postUrl}`);

    // Save current URL (profile page)
    const profileUrl = window.location.href;

    try {
      // Navigate to post
      window.location.href = postUrl;
      await sleep(POST_WAIT_MS);

      // Wait for page to fully load
      await sleep(3000);

      // Extract data from page
      const postData = {
        index: index,
        url: postUrl,
        scrapedAt: new Date().toISOString(),
        success: false,
        caption: '',
        hashtags: [],
        mentions: [],
        phones: [],
        emails: [],
        imageUrl: '',
        videoUrl: '',
        likes: 0,
        comments: 0,
        date: null
      };

      // Get page text for analysis
      const pageText = document.body.innerText;

      // Try multiple caption selectors
      const captionSelectors = [
        'h1',
        'div[data-testid="post-comment-root"]',
        'span[dir="auto"]',
        'article div span'
      ];

      for (const selector of captionSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const text = el.innerText || el.textContent;
            if (text && text.length > 20) {
              postData.caption = text;
              break;
            }
          }
          if (postData.caption) break;
        } catch (e) {}
      }

      // Extract hashtags from caption
      const hashtagMatches = postData.caption.match(/#[\w]+/g) || [];
      postData.hashtags = hashtagMatches;

      // Extract mentions from caption
      const mentionMatches = postData.caption.match(/@[\w.]+/g) || [];
      postData.mentions = mentionMatches;

      // Extract phone numbers
      postData.phones = extractPhoneNumbers(postData.caption);

      // Extract emails
      postData.emails = extractEmails(postData.caption);

      // Try to get image/video
      try {
        const images = document.querySelectorAll('img[src*="instagram"]');
        if (images.length > 0) {
          postData.imageUrl = images[0].src;
        }
      } catch (e) {}

      // Try to get likes and comments
      try {
        const buttons = document.querySelectorAll('button, span');
        for (const btn of buttons) {
          const text = btn.innerText || '';
          if (text.includes('likes') || text.match(/\d+\s+likes/)) {
            const likeMatch = text.match(/(\d+[\d,]*)\s*likes?/i);
            if (likeMatch) {
              postData.likes = parseInt(likeMatch[1].replace(/,/g, ''));
            }
          }
          if (text.includes('comments') || text.includes('comment')) {
            const commentMatch = text.match(/(\d+[\d,]*)\s*comments?/i);
            if (commentMatch) {
              postData.comments = parseInt(commentMatch[1].replace(/,/g, ''));
            }
          }
        }
      } catch (e) {}

      // Extract date from caption
      const dateMatch = postData.caption.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        postData.date = dateMatch[1];
      }

      postData.success = true;

      log(`  ✓ Scraped successfully (${postData.caption.substring(0, 50)}...)`);

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
        index: index,
        url: postUrl,
        scrapedAt: new Date().toISOString(),
        success: false,
        error: error.message
      };
    }
  }

  async function runScrapePhase(postUrls) {
    log('=== Scraping Last Posts (Reverse Order) ===');
    log(`Total posts loaded on page: ${postUrls.length}`);
    log(`Will scrape last ${postsToScrapeFromEnd} posts going UPWARD`);

    // Calculate the range: from (total - count) to (total - 1)
    const startIndex = Math.max(0, postUrls.length - postsToScrapeFromEnd);
    const endIndex = postUrls.length - 1;

    log(`Range: index ${startIndex} to ${endIndex} (total ${postsToScrapeFromEnd} posts)`);

    // Get the subset of URLs to scrape
    const urlsToScrape = postUrls.slice(startIndex, endIndex + 1);

    // REVERSE ORDER: Start from the end and go upward
    for (let i = urlsToScrape.length - 1; i >= 0; i--) {
      const postUrl = urlsToScrape[i];
      const actualIndex = startIndex + i;  // Original index in the postUrls array

      processTitle(`Scraping ${urlsToScrape.length - i}/${urlsToScrape.length} | Index ${actualIndex}`);

      const postData = await scrapePostData(postUrl, actualIndex);
      scrapedPosts.push(postData);

      // Save progress to localStorage every 5 posts
      if ((urlsToScrape.length - i) % 5 === 0) {
        saveResults();
        log(`Progress: ${urlsToScrape.length - i}/${urlsToScrape.length} posts scraped`);
      }

      // Small delay between posts
      await sleep(1000);
    }

    log(`✓ Scraping complete! ${scrapedPosts.length} posts scraped`);
    return scrapedPosts;
  }

  function saveResults() {
    const results = {
      metadata: {
        targetUsername: targetUsername,
        postsToScrapeFromEnd: postsToScrapeFromEnd,
        totalPostsLoaded: collectedUrls.length,
        totalPostsScraped: scrapedPosts.length,
        completedAt: new Date().toISOString(),
        storageKey: STORAGE_KEY,
        mode: 'reverse-only'  // Indicates reverse mode without scrolling
      },
      posts: scrapedPosts,
      allPostUrls: collectedUrls,
      diagnosticLog: diagnosticLog
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
      localStorage.setItem('instagram_scraper_latest', STORAGE_KEY);
    } catch (e) {
      log('⚠ Could not save to localStorage:', e.message);
      // Try to save less data
      try {
        const minimalResults = {
          metadata: results.metadata,
          posts: results.posts.slice(-20), // Last 20 posts only
          allPostUrls: results.allPostUrls.slice(-100) // Last 100 URLs only
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalResults));
      } catch (e2) {
        log('✗ Could not save even minimal data');
      }
    }

    return results;
  }

  async function showResults(results) {
    log('=== Scraping Complete ===');
    log(`Total posts loaded: ${results.metadata.totalPostsLoaded}`);
    log(`Posts scraped: ${results.metadata.totalPostsScraped}`);
    log(`Mode: Reverse-Only (last ${results.metadata.postsToScrapeFromEnd} posts)`);
    log('');
    log('📊 Results Summary:');

    let successCount = 0;
    let totalLikes = 0;
    let totalComments = 0;
    const allHashtags = new Set();
    const allMentions = new Set();
    const allPhones = new Set();
    const allEmails = new Set();

    results.posts.forEach(post => {
      if (post.success) {
        successCount++;
        totalLikes += post.likes || 0;
        totalComments += post.comments || 0;
        (post.hashtags || []).forEach(h => allHashtags.add(h));
        (post.mentions || []).forEach(m => allMentions.add(m));
        (post.phones || []).forEach(p => allPhones.add(p));
        (post.emails || []).forEach(e => allEmails.add(e));
      }
    });

    log(`Successful scrapes: ${successCount}/${results.posts.length}`);
    log(`Total likes: ${totalLikes.toLocaleString()}`);
    log(`Total comments: ${totalComments.toLocaleString()}`);
    log(`Unique hashtags: ${allHashtags.size}`);
    log(`Unique mentions: ${allMentions.size}`);
    log(`Phone numbers found: ${allPhones.size}`);
    log(`Emails found: ${allEmails.size}`);
    log('');
    log('💾 Results saved to localStorage');
    log(`📂 View results at: file:///D:/Hilmi/Coding/WebScraper/public/scraper-results.html`);
    log(`   Or open scraper-results.html from the WebScraper/public/ folder`);

    // Show a few sample posts
    if (results.posts.length > 0) {
      log('');
      log('Sample posts:');
      results.posts.slice(0, 3).forEach(post => {
        if (post.success) {
          log(`  [Index ${post.index}] ${post.url}`);
          log(`      Caption: ${post.caption.substring(0, 60)}...`);
          if (post.phones.length > 0) log(`      Phones: ${post.phones.join(', ')}`);
          if (post.emails.length > 0) log(`      Emails: ${post.emails.join(', ')}`);
        }
      });
    }

    // Send to server to save to /parsed folder
    log('');
    log('📤 Sending results to server for /parsed folder...');
    try {
      const serverResponse = await fetch('http://localhost:3003/api/browser-scraper/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results })
      });

      if (serverResponse.ok) {
        const serverData = await serverResponse.json();
        log(`✓ Results saved to /parsed/${serverData.filename}`);
        log(`  Session ID: ${serverData.sessionId}`);
        log(`  Increment: ${serverData.increment}`);
        log(`  Posts saved: ${serverData.postsSaved}`);
        log('');
        log('🎯 Next step: Ask Claude to parse the file per MASTER_RULE.md');
      } else {
        const errorText = await serverResponse.text();
        log(`⚠ Could not save to /parsed folder: ${errorText}`);
        log('   Results are still available in localStorage and downloaded JSON');
      }
    } catch (error) {
      log(`⚠ Could not connect to server: ${error.message}`);
      log('   Make sure server is running (npm start)');
      log('   Results are still available in localStorage and downloaded JSON');
    }

    // Download results as JSON
    try {
      const dataStr = JSON.stringify(results, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `instagram-scraper-reverse-${targetUsername}-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      log('📥 Results downloaded as JSON');
    } catch (e) {
      log('⚠ Could not download JSON:', e.message);
    }

    // Restore title
    document.title = 'Instagram';
  }

  async function main() {
    log('=== Instagram Browser-Based Scraper - REVERSE MODE (No Scroll) ===');
    log('🔄 Scrapes LAST posts going UPWARD from already loaded page');
    log('');

    // Check we're on Instagram
    if (!window.location.href.includes('instagram.com')) {
      log('❌ ERROR: Please navigate to an Instagram profile first!');
      log('   Example: instagram.com/infolomba');
      return;
    }

    // Get current username from URL
    const urlMatch = window.location.href.match(/instagram\.com\/([^\/]+)/);
    if (urlMatch) {
      targetUsername = urlMatch[1].replace('/', '');
      log(`📍 Current profile: @${targetUsername}`);
    }

    // Collect post URLs from the already-loaded page
    log('📋 Collecting post URLs from current page...');
    const links = getPostLinks();
    collectedUrls.push(...links);
    log(`✓ Found ${collectedUrls.length} posts loaded on this page`);
    log('');

    if (collectedUrls.length === 0) {
      log('❌ ERROR: No posts found on this page!');
      log('   Make sure you scrolled first using browser-scroller.js');
      log('   Then run this script WITHOUT refreshing the page.');
      return;
    }

    // Ask user how many posts to scrape from the end
    const countInput = prompt(
      `📊 ${collectedUrls.length} posts loaded.\n\n` +
        'How many LAST posts do you want to scrape?\n\n' +
        'The scraper will start from the newest loaded post and go upward.\n\n' +
        'Examples:\n' +
        `  • 10 = Scrape last 10 posts (index ${Math.max(0, collectedUrls.length - 10)} to ${collectedUrls.length - 1})\n` +
        `  • 20 = Scrape last 20 posts\n` +
        `  • 50 = Scrape last 50 posts\n` +
        `  • ${collectedUrls.length} = Scrape all ${collectedUrls.length} posts\n\n` +
        'Enter number of posts to scrape:',
      '10'
    );

    if (!countInput) {
      log('❌ Cancelled by user');
      return;
    }

    postsToScrapeFromEnd = parseInt(countInput) || 10;

    // Validate input
    if (postsToScrapeFromEnd > collectedUrls.length) {
      log(`⚠ Requested ${postsToScrapeFromEnd} posts but only ${collectedUrls.length} available`);
      postsToScrapeFromEnd = collectedUrls.length;
    }

    if (postsToScrapeFromEnd <= 0) {
      log('⚠ Invalid number. Using default: 10');
      postsToScrapeFromEnd = 10;
    }

    const startIndex = Math.max(0, collectedUrls.length - postsToScrapeFromEnd);
    const endIndex = collectedUrls.length - 1;

    log('');
    log('📋 Final Configuration:');
    log(`  Posts loaded: ${collectedUrls.length}`);
    log(`  Will scrape: last ${postsToScrapeFromEnd} posts (index ${startIndex} to ${endIndex})`);
    log(`  Direction: UPWARD (from post ${endIndex} to post ${startIndex})`);
    log('');
    log('🚀 Starting scrape phase...');
    log('');

    try {
      // Scrape posts in reverse order
      await runScrapePhase(collectedUrls);

      // Save and show results
      const results = saveResults();
      await showResults(results);

    } catch (error) {
      log('❌ Error:', error.message);
      log(error.stack);
    }
  }

  // Run the scraper
  main().catch(error => {
    console.error('Fatal error:', error);
  });

})();
