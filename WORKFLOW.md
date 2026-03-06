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

**Script:** `collect-post-urls.js`

**Location:** `D:\Hilmi\Coding\WebScraper\public\`

**How to Run:**
```bash
# Option A: Copy to console
1. After Step 1 completes, DO NOT refresh page
2. Paste: http://localhost:3003/collect-post-urls.js into Console
3. Press Enter
4. Enter number of LAST posts to collect (e.g., 50)

# Option B: Run directly
node public/collect-post-urls.js
```

**Expected Output:**
- Prompts: "How many LAST posts?"
- Downloads JSON file: `post-urls-infolomba-xxx.json`
- JSON saved to: `collected_link/` folder

**Tips:**
- Always use "last N posts" to scrape from newest loaded post
- JSON file is saved to `collected_link/` folder
- File naming: `post-urls-infolomba-{random}.json`

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
| 2: Collect Links | `collect-post-urls.js` | Last N posts | `collected_link/*.json` |
| 3: Scrape | `scrape-multiple-posts.js` | JSON file | `/parsed/*.csv` |

---

## Important Notes

### ✅ Do This Order

1. ✅ Run browser-scroller.js FIRST (load posts)
2. ✅ Run collect-post-urls.js NEXT (collect links)
3. ✅ Run scrape-multiple-posts.js LAST (scrape to CSV)
4. ✅ Use Claude LLM to parse

### ❌ Don't Do This

❌ Don't run scraper scripts before collecting links
❌ Don't use scrape-urls-selenium.js (old buggy version)
❌ Don't use scrape-urls-to-csv.js (console tool - stuck issues)
❌ Don't use single post scripts (use multiple-posts instead)

### File Locations

```
D:\Hilmi\Coding\WebScraper\
├── public/
│   ├── browser-scroller.js       ← Use this FIRST
│   ├── collect-post-urls.js      ← Use this SECOND
│   ├── scrape-multiple-posts.js  ← Use this LAST
│   └── (other tools...)
├── collected_link/              ← JSON files stored here
├── parsed/                   ← CSV files saved here
├── output/                   ← Claude LLM outputs here
└── scrape-multiple-posts.js    ← Also in root (for convenience)
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
