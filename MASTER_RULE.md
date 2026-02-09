# IG Data to Sales-CRM Flow

This document explains the 7-step flow of how Instagram (IG) data is processed and becomes a table in the Sales CRM on the VPS. Follow each step strictly and in order.

## Step 1: Run Test Debug from Interface

A test debug is executed from the application interface impat `http://localhost:3003/debug.html`.

**Endpoint:** `POST /api/debug/start`

**Request Body:**
```json
{
  "postLink": "https://www.instagram.com/username/",
  "startIndex": 0,
  "endIndex": 5,
  "instaUsername": "your_username",
  "instaPassword": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "debug-1739000000000",
  "message": "Debug session started"
}
```

This action triggers the IG data fetching via `scraper.js` with `--debug` and `--session` flags.

---

## Step 2: Parsed File Generation and Format Validation

Each test debug run must generate **exactly one (1)** new file in the `/parsed` folder.

**File Location:** `D:\Hilmi\Coding\WebScraper\parsed\`

**File Name Format:**
```
example_parsed#{increment}-{sessionId}-{timestamp}.csv
```

**Example:**
```
example_parsed#1-0d0b3e2e-1770447189633.csv
example_parsed#2-a1b2c3d4-1770567890123.csv
```

**CSV Structure (columns):**
```csv
session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited
```

**Validation Rules:**
- Claude must verify filename format: `example_parsed#{increment}-{sessionId}-{timestamp}.csv`
- Claude must verify CSV structure matches expected columns
- Data must be readable, consistent, not malformed
- If format is incorrect, file must be treated as invalid

> **IMPORTANT:** Do NOT create any files in `/output` folder during this step.

---

## Step 3: Parsed File Naming Rules (Increment)

Every new parsed file must use an incremental index.

**Logic:**
1. Read all files in `/parsed` folder
2. Extract the increment number from filename pattern: `parsed#{number}-`
3. Find the highest increment number
4. New file = highest increment + 1

**Example:**
```
Latest file:  example_parsed#3-xxx-xxx.csv
Next file:    example_parsed#4-xxx-xxx.csv
```

**Code Reference:** `scraper.js` - `getNextIncrement()` function

---

## Step 4: One Parsed File per Debug Run

Each test debug run must produce **only one** parsed file in `/parsed`.

- Do NOT generate multiple CSV files
- Do NOT generate JSON files in `/output`
- Only generate: `/parsed/example_parsed#{increment}-{sessionId}-{timestamp}.csv`

This rule is mandatory to avoid clutter and ambiguous processing states.

---

## Step 5: Claude LLM Parsing Responsibility (Parsed → Output)

After Step 1-4 complete, user prompts Claude to parse the data.

**User Prompt:**
```
"Read MASTER_RULE.md and parse the newest file in /parsed folder.
Convert it to JSON format and save to /output folder."
```

**Claude's Tasks:**
1. Read the newest valid file in `/parsed` folder
2. Parse and interpret the caption content using LLM intelligence
3. Extract: title, organizer, date, location, fee, contacts
4. Normalize and clean data
5. Convert to structured JSON format
6. Save to `/output/example_scraped#{increment}-{sessionId}-{timestamp}.json`

**Input:** `/parsed/example_parsed#{increment}-{sessionId}-{timestamp}.csv`

**Output:** `/output/example_scraped#{increment}-{sessionId}-{timestamp}.json`

**JSON Structure:**
```json
{
  "session_id": "0d0b3e2e",
  "profile_url": "https://www.instagram.com/username/",
  "username": "username",
  "scrape_timestamp": "2025-01-11T12:34:56.789Z",
  "parse_timestamp": "2025-01-11T13:00:00.000Z",
  "posts": [
    {
      "post_index": 0,
      "post_url": "https://www.instagram.com/p/ABC123/",
      "original_caption": "Full caption text here...",
      "extracted_title": "Event Name",
      "extracted_organizer": "Organizer Name",
      "extracted_date": "2025-03-15",
      "extracted_location": "Location Name",
      "registration_fee": "Free / Rp 50000",
      "phone_numbers": ["6281234567890", "6289876543210"],
      "contact_persons": ["Contact Name 1", "Contact Name 2"],
      "parse_status": "parsed"
    }
  ],
  "summary": {
    "total_posts": 5,
    "successfully_parsed": 4,
    "non_events": 1,
    "posts_with_contacts": 3
  }
}
```

> **Note:** `parsinglogic.txt` is known to be poor, unreliable, and insufficient. Because of this limitation, Claude LLM is explicitly responsible for performing the parsing logic, interpretation, normalization, and data cleanup.

---

## Step 6: Output File Naming Rules (Increment)

Output files in `/output` must follow the same incremental naming rules.

**File Name Format:**
```
example_scraped#{increment}-{sessionId}-{timestamp}.json
```

**Increment Logic:**
- Must match the increment from the corresponding parsed file
- If parsed file is `parsed#5-xxx-xxx.csv`, output must be `scraped#5-xxx-xxx.json`

**Rules:**
- Must increment properly
- Must not overwrite previous output file indices
- Must not duplicate indices

---

## Step 7: Sales CRM Integration

The final output JSON from `/output` is sent to the Sales CRM on the VPS.

**Endpoint:** `POST /api/vps/upload`

**Request Body:**
```json
{
  "sessionId": "0d0b3e2e",
  "data": { ... JSON content from /output file ... }
}
```

The VPS processes the data and creates/updates a table in the Sales CRM database.

---

## Summary Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Interface (debug.html)                                   │
│ POST /api/debug/start → scraper.js --debug --session            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2-4: Generate Parsed File                                  │
│ Output: /parsed/example_parsed#{N}-{session}-{timestamp}.csv    │
│                                                                 │
│ - Auto-increment #N                                             │
│ - CSV format with raw captions                                  │
│ - NO JSON in /output                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Claude LLM Parsing                                      │
│ User prompts: "Parse newest /parsed file per MASTER_RULE.md"    │
│                                                                 │
│ Input:  /parsed/example_parsed#{N}-{session}-{timestamp}.csv    │
│ Output: /output/example_scraped#{N}-{session}-{timestamp}.json  │
│                                                                 │
│ Claude responsibilities:                                         │
│ - Read CSV                                                      │
│ - Extract event info (title, organizer, date, etc.)             │
│ - Normalize data                                                │
│ - Create JSON                                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6-7: Send to VPS CRM                                        │
│ POST /api/vps/upload with JSON content                          │
│                                                                 │
│ VPS creates table in Sales CRM database                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure Reference

```
D:\Hilmi\Coding\WebScraper\
├── MASTER_RULE.md           ← This file
├── scraper.js               ← Step 1-4: Scrape & generate CSV
├── server.js                ← Interface API endpoints
├── apiClient.js             ← VPS communication
├── public/
│   └── debug.html           ← Step 1: User interface
├── parsed/
│   ├── sessions-index.csv   ← Track all sessions
│   ├── example_parsed#1-xxx-xxx.csv
│   ├── example_parsed#2-xxx-xxx.csv
│   └── example_parsed#3-xxx-xxx.csv
└── output/
    ├── example_scraped#1-xxx-xxx.json  ← Created by Claude (Step 5)
    ├── example_scraped#2-xxx-xxx.json
    └── example_scraped#3-xxx-xxx.json
```

---

## Quick Reference for Claude (Future Sessions)

When user says: **"Parse per MASTER_RULE.md"**

1. Read `MASTER_RULE.md`
2. List files in `/parsed` folder, find newest with pattern `example_parsed#{N}-*.csv`
3. Read that CSV file
4. Parse each row's caption using LLM
5. Create JSON structure
6. Save to `/output/example_scraped#{N}-{sessionId}-{timestamp}.json`
7. Confirm completion to user

When user says: **"Send to VPS"**

1. Read newest file in `/output` folder
2. POST to VPS endpoint
3. Confirm completion
