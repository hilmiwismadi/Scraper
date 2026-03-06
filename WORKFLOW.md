# Instagram Scraper - Workflow Guide

## Complete Workflow (Step-by-Step)

Follow this order to successfully scrape Instagram posts and parse them with Claude LLM.

---

## Step 1: Scroll & Load Posts

**Script:** `browser-scroller.js`

**Location:** `D:\Hilmi\Coding\WebScraper\public\`

**How to Run:**
```bash
# Option A: Copy script to console
1. Open Instagram in Chrome (www.instagram.com/infolomba)
2. Press F12 to open DevTools → Console tab
3. Open: http://localhost:3003/browser-scroller.js
4. Copy entire script (Ctrl+A, Ctrl+C)
5. Paste into console and press Enter
6. Enter lazy loading count (e.g., 200 for ~1000 posts)
7. Wait for scroll to complete

# Option B: Add to command (if using VS Code terminal)
node public/browser-scroller.js
```

**Expected Output:**
- Console shows progress
- Browser scrolls automatically
- Posts loaded: displayed at completion

**Tips:**
- Start with smaller count (50-100) to test
- Each scroll waits 3 seconds
- Don't refresh page during scrolling

---

## Step 2: Collect Links

**Option A: Single Batch** (Recommended for simple use)

**Script:** `console-collect-urls.js`

**Location:** `D:\Hilmi\Coding\WebScraper\public\`

**How to Run:**
```bash
# Use browser console (RECOMMENDED - no Node.js needed)
1. After Step 1 completes, DO NOT refresh page
2. Open: D:\Hilmi\Coding\WebScraper\public\console-collect-urls.js
3. Copy entire script (Ctrl+A, Ctrl+C)
4. Paste into Instagram DevTools Console and press Enter
5. Enter number of LAST posts to collect (e.g., 50, 100, 900)
6. JSON file downloads automatically
```

**Option B: Multiple Batches with Scroll Up** (Best for collecting many posts)

**Script:** `console-collect-urls-scrollup.js`

**Location:** `D:\Hilmi\Coding\WebScraper\public\`

**How to Run:**
```bash
# User-specified number of batches (2, 5, 10, etc.)
1. Scroll down manually to load posts (e.g., to May 2025)
2. Open: D:\Hilmi\Coding\WebScraper\public\console-collect-urls-scrollup.js
3. Copy entire script (Ctrl+A, Ctrl+C)
4. Paste into Instagram DevTools Console and press Enter
5. Enter number of batches (2, 5, 10, etc.)
6. Multiple JSON files download automatically
```

**Expected Output:**
- Prompts: "How many batches?"
- Batch 1: 47 posts from current page
- Automatically scrolls up to load more posts
- Batch 2: 47 posts from newly loaded posts
- Scrolls up again... repeats for each batch
- Total: batches × 47 posts across N JSON files

**Examples:**
- 2 batches = 94 posts (2 JSON files)
- 5 batches = 235 posts (5 JSON files)
- 10 batches = 470 posts (10 JSON files)

**Tips:**
- Works with any number up to posts loaded on page (can handle 900+)
- Scroll-up version automatically loads older posts without manual scrolling
- User inputs number of batches: 2 = 94 posts, 5 = 235 posts, 10 = 470 posts
- NO Node.js required - runs entirely in browser
- Copy JSON files to `collected_link/` folder for Step 3

---

## Step 3: Scrape to CSV

**Script:** `scrape-multiple-posts.js`

**Location:** `D:\Hilmi\Coding\WebScraper\` (root folder)

**How to Run:**
```bash
# Use the JSON file from Step 2
node scrape-multiple-posts.js collected_link/post-urls-infolomba-1772781417966.json
```

**Expected Output:**
- Opens Instagram URLs one by one using Selenium
- Extracts FULL caption (no character limit)
- Saves to CSV in `/parsed` folder
- Creates exactly ONE CSV file per run

**Tips:**
- Chrome will open automatically
- Wait between posts (~500ms delay)
- Progress shown in console
- CSV file: `parsed#{N}-{timestamp}.csv`
- Make sure `/parsed` folder exists

---

## Step 4: Parse with Claude LLM

**No script needed** - Use Claude!

**Prompt for Claude:**
```
"Read MASTER_RULE.md and parse the newest file in /parsed folder"
```

**Expected Output:**
- Extracts event info (title, organizer, date, location, fee)
- Normalizes data (phone numbers, etc.)
- Creates output JSON in `/output` folder

**Tips:**
- Make sure `/parsed` folder has the latest CSV
- Run: "Read MASTER_RULE.md" first
- Then run the parser on the newest file

---

## Quick Reference

| Step | Script | Input | Output Location |
|------|--------|-------|----------------|
| 1: Scroll | `browser-scroller.js` | Lazy count | Browser loads posts |
| 2A: Collect | `console-collect-urls.js` | Last N posts | Browser Downloads |
| 2B: Collect N× | `console-collect-urls-scrollup.js` | Batches (2,5,10...) | N× Browser Downloads |
| 3: Scrape | `scrape-multiple-posts.js` | JSON file | `/parsed/*.csv` |

---

## Important Notes

### ✅ Do This Order

1. ✅ Run browser-scroller.js FIRST (load posts)
2. ✅ Run console-collect-urls.js OR console-collect-urls-scrollup.js NEXT
   - Single batch: console-collect-urls.js (enter any number)
   - Multiple batches: console-collect-urls-scrollup.js (enter 2, 5, 10, etc.)
3. ✅ Move JSON files to collected_link/ folder
4. ✅ Run scrape-multiple-posts.js (scrape to CSV)
5. ✅ Use Claude LLM to parse

### ❌ Don't Do This

❌ Don't run scraper scripts before collecting links
❌ Don't use scrape-urls-selenium.js (old buggy version)
❌ Don't use scrape-urls-to-csv.js (console tool - stuck issues)
❌ Don't use collect-post-urls.js (use console-collect-urls.js instead)
❌ Don't use single post scripts (use multiple-posts instead)

### File Locations

```
D:\Hilmi\Coding\WebScraper\
├── public/
│   ├── browser-scroller.js              ← Use this FIRST (browser console)
│   ├── console-collect-urls.js          ← Use this SECOND A (single batch)
│   ├── console-collect-urls-scrollup.js ← Use this SECOND B (user input batches)
│   └── (other tools...)
├── console-collect-urls.js             ← Also in root (same as public/)
├── scrape-multiple-posts.js             ← Use this THIRD (Node.js)
├── collected_link/                      ← Copy JSON files here
├── parsed/                              ← CSV files saved here
└── output/                              ← Claude LLM outputs here
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Chrome doesn't open | Make sure Chrome is installed |
| No posts found | Check you're logged into Instagram |
| Script errors | Check console for error messages |
| CSV not created | Check if `/parsed` folder exists |

---

**Last Updated:** 2026-03-06
