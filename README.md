# Instagram Scraper (Local)

Local Selenium scraper that uploads results to CRM on VPS.

## Setup

1. **Install dependencies:**
   ```bash
   cd D:\Hilmi\Coding\WebScraper
   npm install
   ```

2. **Configure `.env`:**
   ```env
   # Get your auth token from CRM:
   # 1. Login to https://sales.webbuild.arachnova.id
   # 2. Open browser DevTools (F12)
   # 3. Go to Application tab -> Local Storage
   # 4. Copy the 'authToken' value
   VPS_API_TOKEN=your_jwt_token_here

   # Optional: Instagram credentials for private profiles
   INSTAGRAM_USERNAME=
   INSTAGRAM_PASSWORD=
   ```

## Usage

### Basic scraping (visible browser window):
```bash
node scraper.js https://www.instagram.com/username/
```

### Scrape with range:
```bash
node scraper.js https://www.instagram.com/username/ --start 0 --end 50
```

### Scrape with login (for private profiles):
```bash
node scraper.js https://www.instagram.com/username/ --auth
```

### Headless mode (no window):
```bash
node scraper.js https://www.instagram.com/username/ --headless
```

## Options

| Option | Description |
|--------|-------------|
| `--start N` | Start post index (default: 0) |
| `--end N` | End post index (default: 20) |
| `--auth` | Use Instagram login from .env |
| `--headless` | Run in headless mode (no window) |
| `--help` | Show help message |

## Output

- **Data uploaded to VPS CRM** automatically
- **Local backup** saved to `output/` folder
- **Live view** of browser window (unless --headless)

## Example Output

```
=== Instagram Scraper (Local) ===

Profile: https://www.instagram.com/eventlistings/
Range: 0 to 20
Auth: No
Mode: Visible (Window will open)

→ Starting Chrome browser...
✓ Browser opened

→ Navigating to Instagram...
✓ Instagram loaded

=== Navigating to profile @eventlistings ===
✓ Profile is accessible

=== Loading posts by scrolling ===
[██████████████████████████████████████████████████] 100% | Scrolling complete
✓ Posts loaded

=== Extracting post links ===
✓ Found 156 total posts
→ Scraping 20 posts (index 0 to 20)

=== Scraping posts ===

[██████████████████████████████████████████████████] 100% | Post 20

=== Scraping Summary ===
Total posts processed: 20
Successfully scraped: 20
Posts with phone numbers: 8

✓ Local backup saved: D:\...\scraped-abc12345-1234567890.json
✓ VPS session updated

=== Done! ===
```

## Troubleshooting

**Chrome not installed?**
- Download Chrome: https://www.google.com/chrome/

**VPS connection error?**
- Check your VPS_API_TOKEN is correct
- Check VPS is accessible: `ping sales.webbuild.arachnova.id`

**Instagram login not working?**
- Make sure INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD are set in .env
- Use --auth flag when running
