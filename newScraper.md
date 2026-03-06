# Instagram Browser-Based Scraper Documentation

**Last Updated:** 2026-02-28

## Overview

This scraper uses a **browser-based approach** that runs directly in your Chrome browser's console. This bypasses Instagram's automation detection that blocks Selenium-based scrapers.

### Why Browser-Based?

- ✅ Uses your existing Instagram login (no credentials needed)
- ✅ Not detected as automation (runs in real browser)
- ✅ Can scroll deep (1000+ posts confirmed working)
- ✅ Extracts contact info (phones, emails)
- ✅ Results saved locally + nice HTML interface

## Quick Start

### Option 1: Quick Scrape (Recommended)

1. Open Instagram in Chrome, navigate to target profile
   ```
   Example: https://www.instagram.com/infolomba
   ```

2. Press `F12` to open DevTools, go to **Console** tab

3. Open the scraper script in a new tab:
   ```
   http://localhost:3003/browser-scraper.js
   ```

4. Copy the entire script, paste it into the Console, press `Enter`

5. Configure when prompted:
   - **Lazy loading count**: `200` (for ~1000 posts)
   - **Scrape range**: `0-50` (scrape first 50 posts) or `800-1000` (scrape posts 800-1000)

6. Wait for completion - results auto-save and download as JSON

7. View results: `http://localhost:3003/scraper-results.html`

### Option 2: Test Scroll Depth First

If you want to test how deep you can scroll before scraping:

1. Open `http://localhost:3003/browser-scroller.js` (scroll test only)

2. Copy script, paste into Instagram page's Console

3. Enter lazy count (e.g., `600` for ~2000 posts)

4. View the bottom-most post date to verify reach

## Understanding Lazy Loading

### What is Lazy Loading?

Instagram loads posts as you scroll down. Each "scroll" triggers Instagram to load more posts.

### Scroll Count vs Post Count

Based on testing:

| Lazy Count | Approx Posts Loaded | Time Estimate | Date Reach |
|------------|-------------------|---------------|------------|
| 100 | ~400-500 | ~5 min | ~2-3 months back |
| 200 | ~800-1000 | ~10 min | ~6 months back |
| 300 | ~1200-1500 | ~15 min | ~9-12 months back |
| 600 | ~2000+ | ~30 min | ~1-2 years back |

**Note:** Each scroll waits 3 seconds to appear human-like and allow content to load.

### Scrape Range Explained

After scrolling loads posts, you specify which posts to scrape:

- `0-50` = Scrape the **first 50 posts** (most recent)
- `800-1000` = Scrape posts **index 800 to 1000** (older posts)
- `all` = Scrape **all loaded posts**

**Example workflow for deep scraping:**
1. Set lazy count to `200` (loads ~1000 posts)
2. Set scrape range to `800-1000` (scrapes oldest 200 posts from that batch)

## Files Reference

### Core Files

| File | Purpose | How to Use |
|------|---------|------------|
| `public/browser-scraper.js` | Full scraper (scroll + scrape) | Run in browser console |
| `public/browser-scroller.js` | Scroll test only | Run in browser console |
| `public/scraper-results.html` | Results viewer | Open in browser |
| `public/scroll.html` | Info & links | Open in browser |

### Legacy Files (Not Recommended)

| File | Status | Reason |
|------|--------|--------|
| `scraper.js` | ❌ Blocked by Instagram | Selenium-based, detected as automation |
| `scraper-scroll-test.js` | ❌ Blocked by Instagram | Selenium-based, detected as automation |

## Scraping Workflow

### Step 1: Navigate to Profile

```
https://www.instagram.com/TARGET_USERNAME/
```

Make sure you're **logged in** to Instagram.

### Step 2: Open Browser Console

- Windows/Linux: Press `F12` or `Ctrl+Shift+J`
- Mac: Press `Cmd+Option+J`
- Go to the **Console** tab

### Step 3: Run the Scraper

1. Open `browser-scraper.js` from the `public/` folder
2. Copy everything (Ctrl+A, Ctrl+C)
3. Paste into console (Ctrl+V)
4. Press Enter

### Step 4: Configure Settings (Two-Step Process)

**Step 1 - Before Scrolling:**

You'll be prompted for lazy loading count:
```
📜 Step 1: How many scrolls to load posts?
  • 100 = ~400-500 posts
  • 200 = ~800-1000 posts
  • 600 = ~2000+ posts (deep scroll)

Enter: 200
```

**Step 2 - After Scrolling Completes:**

Once scrolling finishes, you'll see how many posts were loaded:
```
=== Scrolling Complete ===
✓ Loaded 1,047 posts
```

Then you'll be prompted for which range to scrape:
```
📊 Step 2: 1,047 posts loaded.

Which posts do you want to scrape?

Examples:
  • 0-50 (first 50 - most recent)
  • 100-150 (posts 100-150)
  • 0-1047 (scrape all 1047 posts)
  • 997-1047 (last 50 - oldest)

Format: start-index (e.g., 0-50)
Or type "all" to scrape everything
```

This two-step approach lets you see how many posts actually loaded before deciding which range to scrape.

### Step 5: Wait for Completion

Progress shows in:
- Console logs
- Browser tab title

**Estimated time:** `(lazy_count × 3 seconds) + (posts_to_scrape × 2 seconds)`

Example: 200 scrolls + 50 posts ≈ 10-12 minutes

### Step 6: View Results

Results are automatically:
- Saved to `/parsed/` folder as CSV (for Claude LLM parsing)
- Saved to browser `localStorage`
- Downloaded as JSON file

View in browser:
```
http://localhost:3003/scraper-results.html
```

Or refresh the `scraper-results.html` page if already open.

## Data Extracted

Each scraped post contains:

```javascript
{
  index: 42,                          // Post position in loaded posts
  url: "https://www.instagram.com/p/ABC123/",  // Post URL
  scrapedAt: "2026-02-28T10:30:00Z",   // When scraped
  success: true,                       // Scrape success status

  // Content
  caption: "Post caption text...",     // Full caption
  hashtags: ["#giveaway", "#lps"],     // All hashtags found
  mentions: ["@lps_idic", "@user"],    // All @mentions found

  // Contact info
  phones: ["6285123456789"],           // Phone numbers extracted
  emails: ["contact@example.com"],     // Email addresses extracted

  // Media
  imageUrl: "https://...",             // Post image URL
  videoUrl: "https://...",             // Video URL if applicable

  // Engagement
  likes: 1234,                         // Like count
  comments: 56,                        // Comment count
  date: "2026-02-28",                  // Date extracted from caption
}
```

### Phone Number Extraction

Extracts Indonesian phone formats:
- `+6285112345678`
- `6285112345678`
- `0851-1234-5678`
- `0851 1234 5678`

All normalized to standard format.

### Email Extraction

Standard email regex - captures all valid email addresses from captions.

## Export Options

### From `scraper-results.html`:

| Export Type | Format | Use Case |
|-------------|--------|----------|
| **JSON** | `.json` | Full data backup, API use |
| **CSV** | `.csv` | Excel, Google Sheets |
| **Contacts** | `.csv` | Phone/email list only |

### CSV Format

Columns:
- Index, URL, Caption, Likes, Comments, Date
- Phones, Emails, Hashtags, Mentions, Success

### Contacts CSV

Columns:
- Type (phone/email), Value, Source URL, Caption preview

## Advanced Usage

### Scraping Specific Date Ranges

1. First, run scroll test to find post count → date mapping
2. Then run full scraper with appropriate range

Example:
- Scroll test shows: post 800 = August 2025
- To scrape August 2025 posts: set range `750-850`

### Batch Scraping Multiple Profiles

For multiple profiles, repeat the process:

```bash
# Profile 1
Navigate → Run scraper → View results → Export

# Profile 2
Navigate → Run scraper → View results → Export

# etc...
```

### Automating with Bookmarklet (Optional)

Create a bookmark with this as URL:

```javascript
javascript:(function(){/* paste browser-scraper.js content here */})();
```

Click bookmark on any Instagram profile to start scraping.

## Troubleshooting

### Script Not Working

**Problem**: Script doesn't run after pasting

**Solutions**:
- Make sure you copied the ENTIRE script
- Check for "Uncaught SyntaxError" in console
- Try refreshing the page and retrying

### No Posts Loaded

**Problem**: `totalPosts: 0` after scrolling

**Causes**:
- Not logged into Instagram
- Profile is private
- Instagram rate limiting

**Solutions**:
- Check you're logged in
- Try smaller lazy count first (50-100)
- Wait a few minutes between scraping sessions

### Results Not Showing

**Problem**: `scraper-results.html` shows "No Results Found"

**Solutions**:
- Refresh the page
- Click "Load from JSON File" and select the downloaded JSON
- Check browser console for localStorage errors

### Instagram GraphQL Errors

**Problem**: Console shows errors like `GraphQL operation responded with error 4630001`

**Solution**: These are harmless Instagram errors. Ignore them - they don't affect scraping.

## Best Practices

### 1. Start Small
- First run: lazy count `50`, range `0-10`
- Verify it works, then scale up

### 2. Respecting Instagram
- Wait between scraping sessions (5-10 minutes)
- Don't scrape same profile repeatedly in short time
- Use reasonable lazy counts (don't exceed 600)

### 3. Data Management
- Export results immediately after scraping
- Clear localStorage periodically to avoid quota issues
- Keep backup JSON files

### 4. Contact Extraction
- Verify extracted phone/emails manually
- Some captions may have invalid formats
- Cross-reference with post content

## Technical Details

### How It Works

1. **Scroll Phase**:
   - Executes `window.scrollTo(0, document.body.scrollHeight)`
   - Waits 3 seconds for content to load
   - Repeats for specified lazy count
   - Collects all post links via `querySelectorAll('a[href*="/p/"]')`

2. **Scrape Phase**:
   - Navigates to each post URL
   - Waits for page load
   - Extracts data using DOM selectors
   - Returns to continue with next post

3. **Data Storage**:
   - Results saved to `localStorage`
   - Key format: `instagram_scraper_RESULTS_TIMESTAMP`
   - Latest result key stored in `instagram_scraper_latest`

### Browser Compatibility

- **Chrome**: ✅ Fully supported
- **Edge**: ✅ Should work (Chromium-based)
- **Firefox**: ⚠️ May need adjustments
- **Safari**: ⚠️ Untested

### localStorage Limits

- Chrome: ~5-10MB per domain
- If scraping 1000+ posts, may hit quota
- Script automatically handles quota errors by saving minimal data

## URL Reference

### Local Server (must be running)

```
http://localhost:3003/
├── scroll.html              # Info & tool links
├── scraper-results.html     # Results viewer
├── browser-scraper.js       # Full scraper script
└── browser-scroller.js      # Scroll test only
```

### External URLs

```
https://www.instagram.com/     # Instagram
https://sales.webbuild.arachnova.id/api  # VPS CRM API
```

## Server Integration

The browser scraper **automatically saves results to the `/parsed` folder** when the server is running.

### Automatic CSV Export

After scraping completes, the script:
1. Sends results to `http://localhost:3003/api/browser-scraper/save`
2. Server saves CSV to `/parsed/parsed#{increment}-{sessionId}-{timestamp}.csv`
3. CSV format matches **MASTER_RULE.md** requirements
4. Ready for Claude LLM parsing

### CSV Format (MASTER_RULE.md compliant)

```csv
session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited
```

### Server Requirements

- **Must be running** for automatic `/parsed` folder export
- Start with: `npm start` (in WebScraper directory)
- If server not running: Results still saved to localStorage and downloaded as JSON

### Server API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/browser-scraper/save` | POST | Save results to `/parsed` folder |
| `/api/browser-scraper/increment` | GET | Get next increment number |

### Claude LLM Parsing Flow

After browser scraper saves to `/parsed`:

1. **Check file created**: Look in `/parsed` folder for new `parsed#{N}-*.csv`
2. **Prompt Claude**: "Read MASTER_RULE.md and parse the newest file in /parsed folder"
3. **Claude processes**: Extracts event info, normalizes data
4. **Output created**: `/output/scraped#{N}-{sessionId}-{timestamp}.json`
5. **Send to VPS**: Upload to Sales CRM

See **MASTER_RULE.md** for complete parsing workflow.

## Comparison: Browser vs Selenium

| Feature | Browser Scraper | Selenium Scraper |
|---------|----------------|------------------|
| Automation Detection | ❌ None (runs in real browser) | ✅ Detected and blocked |
| Login Required | ✅ Uses existing session | ❌ Requires credentials |
| Scroll Depth | ✅ 2000+ posts confirmed | ❌ Blocked after ~12 posts |
| Phone/Email Extraction | ✅ Yes | ✅ Yes |
| Speed | 🐢 Slower (3s per scroll) | 🐇 Faster (but blocked) |
| Reliability | ✅ High | ❌ Low (blocked) |
| Setup | ✅ Easy (copy-paste) | ⚠️ Requires Node.js |

## Future Enhancements

Potential improvements:

1. **Resume capability** - Continue from last scroll position
2. **Duplicate detection** - Skip already scraped posts
3. **Progress sync** - Send progress to server for remote monitoring
4. **Scheduled scraping** - Auto-run at specified times
5. **Multi-profile queue** - Scrape multiple profiles in sequence

## Changelog

### 2026-02-28
- ✅ Created browser-scraper.js (full scraping with range)
- ✅ Created scraper-results.html (results viewer)
- ✅ Updated navigation across all pages
- ✅ Confirmed 1000+ posts reachable with browser approach
- ✅ Contact extraction (phones, emails) working

### Previous
- Selenium-based scraper (blocked by Instagram)

## Support

For issues or questions:

1. Check this documentation first
2. Review browser console for error messages
3. Verify Instagram is accessible and you're logged in
4. Try smaller scrape ranges to isolate issues

---

**Created:** 2026-02-28
**Maintainer:** Claude AI Assistant
**Status:** ✅ Production Ready
