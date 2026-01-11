# Claude as Instagram Scraping LLM Parser

## Overview
This Instagram scraper extracts event posts (competitions, tournaments, lomba) from Instagram profiles. You are the LLM parser that converts raw scraped captions into structured event data.

---

## Scraping Pipeline Flow

```
1. User inputs Instagram URL (profile or direct post)
   ↓
2. scraper.js extracts caption, phones, images via Selenium
   ↓
3. Scraped data saved to: output/scraped-{sessionId}-{timestamp}.json
   ↓
4. Auto-creates CSV: parsed/parsed-{sessionId}-{timestamp}.csv
   ↓
5. User prompts YOU (Claude) to read THIS file
   ↓
6. You read the CSV and parse event information
   ↓
7. Parsed data displayed in: /parse-manager.html?file=scraped-{sessionId}-{timestamp}.json
```

---

## Input File Format (CSV)

**Location:** `parsed/parsed-{sessionId}-{timestamp}.csv`

**Columns:**
| Column | Description |
|--------|-------------|
| session_id | Unique session identifier (extracted from filename) |
| json_file | Original JSON filename |
| post_index | Post index (0-based) |
| post_url | Instagram post URL |
| original_caption | Raw caption text (quoted field) |
| extracted_title | TO BE FILLED BY YOU |
| extracted_organizer | TO BE FILLED BY YOU |
| extracted_date | TO BE FILLED BY YOU (YYYY-MM-DD) |
| extracted_location | TO BE FILLED BY YOU |
| registration_fee | TO BE FILLED BY YOU |
| phone_numbers | Auto-extracted by scraper (semicolon separated) |
| contact_persons | TO BE FILLED BY YOU (JSON array) |
| parse_status | "pending" → change to "parsed" after done |
| parse_timestamp | Timestamp of your parsing |
| last_edited | Editor tracking |

**Sample CSV Row:**
```csv
abc123,scraped-abc123-1234567890.json,0,https://www.instagram.com/p/XXXXX/,"OPEN REGISTRATION 🏆 Lomba Coding 2025
Tanggal: 15-20 Januari 2025
Tempat: Online
Biaya: Rp 50.000
CP: Budi (08123456789), Siti (08987654321)
Daftar: wa.me/6281234567890",,,,,08123456789;08987654321,,pending,,,,
```

---

## 📁 Optimal CSV File Format for Efficient Parsing

**IMPORTANT FOR CREATING THE INITIAL CSV FILE**: Follow these best practices to ensure Claude can parse efficiently and accurately.

### ✅ CSV Structure Requirements

**File Naming Convention:**
```
parsed/parsed-{sessionId}-{timestamp}.csv
Example: parsed/parsed-304b7acd-1768128145689.csv
```

**Column Order (CRITICAL - Must match this exact order):**
```csv
session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited
```

**Initial Values for Empty Fields:**
| Column | Initial Value | Notes |
|--------|---------------|-------|
| `extracted_title` | **empty** (leave blank, don't use "Not specified") | Let Claude find the title |
| `extracted_organizer` | **empty** (leave blank) | Let Claude find the organizer |
| `extracted_date` | **empty** (leave blank) | Let Claude find the date |
| `extracted_location` | **empty** (leave blank) | Let Claude find the location |
| `registration_fee` | **empty** (leave blank) | Let Claude find the fee |
| `phone_numbers` | **empty** OR valid phone numbers | Do NOT put caption text here! |
| `contact_persons` | **empty** (leave blank) | Let Claude create JSON array |
| `parse_status` | `pending` | Will change to `parsed` after completion |
| `parse_timestamp` | **empty** | Will be filled by Claude |
| `last_edited` | **empty** or system identifier | For tracking purposes |

### ⚠️ Common CSV Creation Mistakes to Avoid

**❌ DON'T DO THIS:**
```csv
...,original_caption,extracted_title,extracted_organizer,extracted_date,...
...,"caption text","Not specified","Not specified","Not specified",...
```
**Problem:** Using "Not specified" wastes Claude's time - it must scan entire caption even if title isn't clear.

**❌ DON'T PUT GARBAGE IN phone_numbers:**
```csv
...,phone_numbers,...
...,"Administrasi Fiskal",...         ← Wrong! This is not a phone number
...,"2025-07-10T05:21:08.000Z",...    ← Wrong! This is a timestamp
...," Suara SDGs Narahubung...",...     ← Wrong! This is caption text
```

**✅ DO THIS INSTEAD:**
```csv
...,original_caption,extracted_title,extracted_organizer,extracted_date,phone_numbers,...
...,"caption text",,,,,...            ← Empty fields are better than "Not specified"
```

### 📝 Proper CSV Formatting Rules

**1. Quote Handling:**
- The `original_caption` field MUST be wrapped in double quotes
- If the caption contains double quotes, escape them as `""`
- Example: `"Caption with ""quotes"" inside"`

**2. Comma Handling:**
- Captions often contain commas - the field MUST be quoted
- Example: `"Open Registration, Event Name, More Info"`
- NOT: `Open Registration, Event Name, More Info` ← Will break parsing!

**3. Phone Number Format:**
- If auto-extracting phones, use semicolon separator: `08123456789;08987654321`
- If no phones found, leave empty: ``
- Never put non-phone data in this field!

### 🎯 Example: Properly Formatted CSV Row

```csv
304b7acd,scraped-304b7acd-1768128145689.json,1200,https://www.instagram.com/infolomba/p/XXXXX/,"[ OPEN REGISTRATION TAX PLANNING COMPETITION 2025 ] HIMAPAJAK FIA UB PROUDLY PRESENTS! Pendaftaran Tax Planning Competition 2025 telah resmi dibuka! Tax Planning Competition 2025 merupakan kompetisi di bidang perpajakan tingkat nasional yang diselenggarakan oleh Himpunan Mahasiswa Perpajakan (HIMAPAJAK), Fakultas Ilmu Administrasi, Universitas Brawijaya. 📆 Timeline Kegiatan: • Pendaftaran - Gelombang Spesial: 27 Juni s.d. 8 Juli 2025 • Gelombang I: 10 s.d. 16 Juli 2025 💰 Biaya Pendaftaran: • Gelombang Spesial: Rp150.000,- 📞 Contact Person: Gracia Vidya Chrismasari Telepon : 085777417335 Najwa Athaya Salsabila Telepon: 085609826040",,,,,,,,pending,,
```

**Key Points:**
- ✅ `original_caption` is properly quoted (contains commas)
- ✅ Empty fields for data to be extracted (no "Not specified")
- ✅ `parse_status` is "pending"
- ✅ No garbage in `phone_numbers` field
- ✅ Proper CSV escaping

### 🔧 Quick Checklist Before Sending CSV to Claude

- [ ] All `original_caption` fields are wrapped in double quotes
- [ ] Empty fields are actually empty (not "Not specified")
- [ ] `phone_numbers` column contains ONLY phone numbers or is empty
- [ ] No caption text fragments in non-caption columns
- [ ] `parse_status` is "pending" for unprocessed rows
- [ ] Header row matches exact column order specified above
- [ ] No timestamp or date strings in `phone_numbers` column
- [ ] CSV uses comma separator (not semicolon or tab)

---

## Your Task: Parse Captions

For each row in the CSV, extract:

### 1. Event Title (extracted_title) - CRITICAL: Extract from FIRST paragraph only!

**IMPORTANT LESSON LEARNED:** Event titles are almost ALWAYS in the FIRST paragraph/line of the caption. Look at the beginning of the caption, not somewhere in the middle!

**Title Extraction Patterns (in order of priority):**
1. `[TITLE]` or `[COMPETITION TITLE]` or `[EVENT NAME 2025]` → extract the TITLE inside brackets
2. `🔥 EVENT NAME 2025 🔥` or `🏆 TITLE 2025 🏆` → extract EVENT NAME/TITLE (remove emojis)
3. `"OPEN REGISTRATION EVENT NAME"` → extract EVENT NAME after "OPEN REGISTRATION"
4. `XYZ proudly present EVENT NAME` → extract EVENT NAME (organizer is before "proudly present")
5. All-caps or title-case text at the beginning like `ALACAZAM 2025`, `GALAXY 2.0`, etc.

**Real Examples from Production:**
- `[ OPEN REGISTRATION TAX PLANNING COMPETITION 2025 ]` → `TAX PLANNING COMPETITION 2025`
- `OSIS SMA PU AL BAYAN PUTRI SUKABUMI proudly present 🌵 ALACAZAM 2025 🌵` → `ALACAZAM 2025`
- `📣 [PEKAN JURNALISTIK 2025 COMPETITION!] 📣` → `PEKAN JURNALISTIK 2025`
- `🔥 CHEM CUP 2025 🔥` → `CHEM CUP 2025`
- `[GALAXY 2.0 × HELTRO 2025]` → `GALAXY 2.0 × HELTRO 2025`
- `🌟 Saatnya Bersuara Lewat Karya! 🎬` (caption starts with hook) → Look for actual title in first few lines or hashtags

**Common Title Formats:**
- `EVENT NAME 2025` (most common)
- `COMPETITION NAME CHALLENGE`
- `EVENT NAME × EVENT NAME` (collaborative events)
- `ACRONYM EVENT NAME` (e.g., `FIKSI 2025`, `NESC 2025`)

**What NOT to extract as title:**
- "Not specified" - keep searching the caption
- Generic phrases like "Saatnya Bersuara Lewat Karya!" or "Open Registration"
- The organizer name (that goes in organizer field)
- Date ranges, fee amounts, hashtags

### 2. Organizer (extracted_organizer) - CRITICAL: Look BEFORE and AFTER the title!

**IMPORTANT LESSON LEARNED:** The organizer is typically mentioned RIGHT BEFORE the title (in "proudly present" pattern) or AFTER the title (in "Presented by" or "diselenggarakan oleh" pattern).

**Organizer Extraction Patterns (in order of priority):**

**Pattern 1: Before the title (most common)**
- `XYZ proudly present TITLE` → XYZ is the organizer
- `XYZ PROUDLY PRESENTS TITLE` → XYZ is the organizer
- `Organization + "mempersembahkan" + TITLE` → Organization is the organizer
- Examples:
  - `HIMAPAJAK FIA UB PROUDLY PRESENTS! Tax Planning Competition` → `HIMAPAJAK FIA UB`
  - `OSIS SMA PU AL BAYAN PUTRI SUKABUMI proudly present ALACAZAM 2025` → `OSIS SMA PU AL BAYAN PUTRI SUKABUMI`
  - `HIMASTA UNDIP mempersembahkan DOKTER DATA 2025` → `HIMASTA UNDIP`

**Pattern 2: After the title**
- `TITLE Presented by XYZ` → XYZ is the organizer
- `TITLE yang diselenggarakan oleh XYZ` → XYZ is the organizer
- Examples:
  - `GALAXY 2.0 presented by CIMSA Syiah Kuala University` → `CIMSA Syiah Kuala University`

**Pattern 3: Mentioned in first paragraph**
- Look for university/organization names in the first 2-3 lines
- Examples:
  - `Otoritas Jasa Keuangan (OJK) kembali menggelar lomba` → `Otoritas Jasa Keuangan (OJK)`
  - `ENGLISH STUDENTS ASSOCIATION PROUDLY PRESENT` → `ENGLISH STUDENTS ASSOCIATION`

**Common Organizer Types:**
- University organizations: `HIMAPAJAK FIA UB`, `EDSA UAD`, `HIMASTA UNDIP`
- Student councils: `OSIS SMA ...`, `BEM FMIPA UM`
- Professional bodies: `Otoritas Jasa Keuangan (OJK)`, `CIMSA`, `AMSA UGM`
- Event organizers: `Global Champion`, `LSPR`

**If organizer is not clearly mentioned:**
- Use `Not specified` - DO NOT guess or use generic terms like "Admin"

### 3. Event Date (extracted_date)
- Format: `YYYY-MM-DD`
- Look for: "Tanggal", "Date", "Deadline", Indonesian months (Januari, Februari, etc.)
- If date range: use start date
- If not found: `Not specified`

### 4. Location (extracted_location)
- Look for: "Tempat", "Location", "Venue", "Online"
- Examples: "Online", "Gelora Bung Karno", "Auditorium A"

### 5. Registration Fee (registration_fee)
- Look for: "Biaya", "Fee", "Harga", "Rp", "FREE", "Gratis"
- Examples: "Rp 50.000", "FREE", "Rp 100.000 - 150.000"

### 6. Contact Persons (contact_persons)
- **JSON array format:** `[{"name": "Name", "phone": "08..."}, ...]`
- Look for: "CP:", "Contact:", "Hubungi:", "WA:" followed by name
- If only phone listed: `{"name": "Admin", "phone": "08..."}`

### 7. Update parse_status
- Change from `pending` to `parsed` when done

---

## Output Format

Return **ONLY valid CSV** that can replace the original file. Format:

```csv
session_id,json_file,post_index,post_url,original_caption,extracted_title,extracted_organizer,extracted_date,extracted_location,registration_fee,phone_numbers,contact_persons,parse_status,parse_timestamp,last_edited
abc123,scraped-abc123-1234567890.json,0,https://www.instagram.com/p/XXXXX/,"OPEN REGISTRATION 🏆 Lomba Coding 2025...","Lomba Coding 2025","Universitas Indonesia","2025-01-15","Online","Rp 50.000","08123456789;08987654321","[{""name"":""Budi"",""phone"":""08123456789""},{""name"":""Siti"",""phone"":""08987654321""}]","parsed","2025-01-11T10:00:00Z",claude
```

**Important:**
- Preserve all original columns
- Keep original_caption exactly as-is (quoted)
- Escape quotes in caption: `"` → `""`
- Escape quotes in JSON: `"` → `""`

---

## Example Caption → Parsed Data

**Input Caption:**
```
🏆 LOMBA CRYPTO TRADING 2025 🏆

Compete and show your trading skills!

📅 Tanggal: 1-28 Februari 2025
💰 Total Hadiah: Rp 10.000.000
📍 Platform: Binance
💳 Biaya: Rp 75.000

Contact Person:
📱 Dina: 08123456789
📱 Rina: 08987654321

Registration: wa.me/6281234567890
```

**Parsed Output:**
```csv
...,0,https://www.instagram.com/p/XXXXX/,"🏆 LOMBA CRYPTO TRADING 2025 🏆...","Lomba Crypto Trading 2025","","2025-02-01","Binance (Online)","Rp 75.000","08123456789;08987654321","[{""name"":""Dina"",""phone"":""08123456789""},{""name"":""Rina"",""phone"":""08987654321""}]","parsed",2025-01-11T10:00:00Z,claude
```

---

## Special Cases

### Non-Event Posts
If the post is NOT an event (personal post, advertisement without event info, random content):
- Set extracted_title to: `NON-EVENT`
- Leave other extracted fields empty
- Set parse_status to: `non-event`

### Partial Information
If some fields are missing:
- Still parse what you can find
- Set missing fields to: `Not specified` or empty string
- Set parse_status to: `partial`

### Duplicate Detection
If multiple posts are for the same event:
- Parse each independently
- Note in extracted_organizer: `Event X (duplicate)`

---

## Quality Checklist

For each parsed row, verify:
- [ ] Title is meaningful (not just "Event" or "Info")
- [ ] Date is in YYYY-MM-DD format
- [ ] Phone numbers in contact_persons match phone_numbers column
- [ ] contact_persons is valid JSON array
- [ ] parse_status updated to "parsed", "partial", or "non-event"
- [ ] Original caption preserved exactly

---

## Web Interface Reference

After parsing, user views results at:
```
http://localhost:3003/parse-manager.html?file=scraped-{sessionId}-{timestamp}.json
```

**Interface shows:**
| # | Event Title | Organizer | Date | Location | Fee | Contacts | Status |
|---|-------------|-----------|------|----------|-----|----------|--------|
| 0 | [Your parsed title] | [Your parsed organizer] | [YYYY-MM-DD] | [Location] | [Fee] | [Phones] | parsed |

**Features:**
- Click "📄" to view original caption
- Edit fields directly if needed
- "Save All Changes" updates the CSV
- "Export CSV" downloads final results
- "Send to VPS" uploads parsed data

---

## Summary: Your Workflow

1. **User provides CSV file path** → Read it
2. **Parse each caption** → Extract event info
3. **Return complete CSV** → With all fields filled
4. **User updates file** → Via web interface or manual
5. **Data sent to VPS** → For final storage

---

## Quick Command Reference

```bash
# After scraping completes, CSV is auto-created at:
parsed/parsed-{sessionId}-{timestamp}.csv

# View in browser:
http://localhost:3003/parse-manager.html?file=scraped-{sessionId}-{timestamp}.json
```

---

## Performance & Efficiency Guidelines

**IMPORTANT:** These guidelines help you parse faster and more accurately. Follow them in order!

### 🚀 Fast Parsing Workflow (Process in Order)

**Step 1: Quick Scan (2-3 seconds per batch)**
```
For each row, scan ONLY the first 200-300 characters of the caption:
- Identify title pattern (brackets, emojis, "proudly present")
- Identify organizer (before or after title)
- Skip detailed reading - extract patterns first
```

**Step 2: Pattern Matching (use these shortcuts)**
```
Title shortcuts:
- "[...]" → extract inside brackets (FASTEST)
- "PROUDLY PRESENT" → extract next phrase after this
- "2025" or "2026" → look for event name before the year
- All caps phrase in first line → likely the title

Organizer shortcuts:
- Before "proudly present" / "mempersembahkan" → that's the organizer
- After "presented by" / "diselenggarakan oleh" → that's the organizer
- First university/org name mentioned in first 2 lines

Date shortcuts:
- Scan for: "Juli", "August", "September" etc.
- Look for: "Deadline:", "Pendaftaran:", "Tanggal:"
- Use LAST date mentioned (usually registration deadline, not event date)
```

**Step 3: Batch Processing Strategy**
```
Process 10-15 rows at a time, not one by one:
1. Read 10 rows
2. Quick-scan all 10 for titles (pattern matching)
3. Quick-scan all 10 for organizers
4. Then go back for dates, fees, contacts
5. Return complete CSV for the batch

This reduces context switching!
```

### ⚡ Speed Optimization Rules

**DO THIS:**
- ✅ Use pattern matching on first 200 chars of caption
- ✅ Extract from FIRST paragraph only (90% of titles are there)
- ✅ Skip reading entire caption for title/organizer
- ✅ Process in batches of 10-15 rows
- ✅ Use "Not specified" immediately if pattern not found in first scan

**DON'T DO THIS:**
- ❌ Read entire caption before extracting title
- ❌ Search through middle/end of caption for title (it's almost always at start)
- ❌ Over-analyze ambiguous patterns - use "Not specified" instead
- ❌ Process row-by-row instead of batches

### 📊 Field Extraction Priority (Parse in This Order)

**Priority 1 (Fastest - Pattern Matching):**
1. **Title** - First 200 chars, look for `[...]`, `🔥...🔥`, `PROUDLY PRESENT XXX`
2. **Organizer** - Look before/after title, first 2-3 lines only

**Priority 2 (Medium - Keyword Search):**
3. **Location** - Scan for "Online", "Tempat:", "Venue:" (first 500 chars)
4. **Date** - Scan for month names, "Deadline", "Pendaftaran" (first 500 chars)
5. **Fee** - Scan for "Rp", "FREE", "Biaya", "Fee" (first 500 chars)

**Priority 3 (Slower - Detailed Extraction):**
6. **Phone Numbers** - Scan entire caption for `08...`, `628...`, `+628...`
7. **Contact Persons** - Parse "CP:", "Contact:", "WA:" patterns (need full caption)

### 🎯 Common Patterns (Memorize These)

**Title Patterns (95% coverage):**
| Pattern | Example | Extract |
|---------|---------|---------|
| `[TITLE 2025]` | `[OPEN REGISTRATION TAX PLANNING COMPETITION 2025]` | TAX PLANNING COMPETITION 2025 |
| `ORG proudly present TITLE` | `HIMAPAJAK FIA UB PROUDLY PRESENTS! Tax Planning Competition` | Tax Planning Competition |
| `🔥 TITLE 🔥` | `🔥 CHEM CUP 2025 🔥` | CHEM CUP 2025 |
| `TITLE IS HERE!` | `INFORMATION SYSTEM FESTIVAL 2025 IS HERE!` | INFORMATION SYSTEM FESTIVAL 2025 |
| `TITLE IS BACK!` | `UNPAR BIZFEST 2.0 IS BACK!` | UNPAR BIZFEST 2.0 |
| All caps first line | `MEDXPLORE AYP 2025` | MEDXPLORE AYP 2025 |

**Organizer Patterns (90% coverage):**
| Pattern | Example | Extract |
|---------|---------|---------|
| `XXX proudly present` | `HIMAPAJAK FIA UB PROUDLY PRESENTS` | HIMAPAJAK FIA UB |
| `XXX mempersembahkan` | `HIMASTA UNDIP mempersembahkan` | HIMASTA UNDIP |
| `XXX kembali menggelar` | `OJK kembali menggelar lomba` | OJK |
| `XXX diselenggarakan oleh` | `diselenggarakan oleh Pekan Budaya Jawa` | Pekan Budaya Jawa |
| `Presented by XXX` | `Presented by CIMSA Syiah Kuala University` | CIMSA Syiah Kuala University |

### 🔧 Quick Reference: When to Use "Not specified"

Use "Not specified" immediately if:
- Title not found in first 300 characters
- Organizer not in "proudly present" pattern and first 3 lines
- No clear date pattern with month name
- No "Rp", "FREE", "Biaya" found in first 500 chars

This saves time vs. searching the entire caption!

---

**End of Documentation. Ready to parse!**
