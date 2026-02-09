import csv
import json
import re
from datetime import datetime

# Read the CSV file
input_file = r'D:\Hilmi\Coding\WebScraper\parsed\parsed-304b7acd-1768128145689.csv'
output_file = r'D:\Hilmi\Coding\WebScraper\parsed\parsed-304b7acd-1768128145689-parsed.csv'

def clean_caption(caption):
    """Clean the Instagram caption format"""
    if not caption:
        return ""
    # Remove the prefix "X likes, Y comments - username on date: "
    caption = re.sub(r'^\d+\s+(?:likes|comments).*?:\s*"', '', caption)
    caption = re.sub(r'^"', '', caption)
    caption = re.sub(r'"\.$', '', caption)  # Remove trailing quote and dot
    return caption.strip()

def extract_title(caption):
    """Extract event title from caption"""
    caption = clean_caption(caption)
    if not caption:
        return "NON-EVENT"

    # Look for specific title patterns
    patterns = [
        r'\[\s*OPEN\s+REGISTRATION\s+(.*?)\s*\]',
        r'OPEN\s+REGISTRATION\s+(.*?)(?:\n|📆|📍|💰|📞|PROUDLY|proudly|$)',
        r'(LOMBAs?\s+.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'(WRITING\s+COMPETITION.*?)(?:\n|📆|📍|💰|📞|$)',
        r'(COMPETITION.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'(COMPETISI.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'(KOMPETISI.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'\[?\s*(.*?)\s*\]?\s*PROUDLY\s+PRESENT',
    ]

    for pattern in patterns:
        match = re.search(pattern, caption, re.IGNORECASE | re.DOTALL)
        if match:
            title = match.group(1).strip()
            # Clean up title
            title = re.sub(r'\s+', ' ', title)
            title = re.sub(r'🏆|🌟|✨|🔥|📣|📢|🚀', '', title)
            title = title.strip()
            if 5 < len(title) < 150:
                return title

    # Get first meaningful line
    lines = caption.split('\n')
    for line in lines[:5]:
        line = line.strip()
        # Skip hashtags and emojis-only lines
        if line and not line.startswith('#') and 5 < len(line) < 150:
            # Remove emojis
            line = re.sub(r'[^\w\s\-\(\)\.]+', ' ', line)
            line = ' '.join(line.split())
            if len(line) > 5:
                return line[:100]

    return "Not specified"

def extract_organizer(caption):
    """Extract organizer from caption"""
    caption = clean_caption(caption)
    if not caption:
        return "Not specified"

    patterns = [
        r'(?:diselenggarakan\s+oleh|organized\s+by|hosted\s+by)\s*:\s*([^\n\.]+?)(?:\.|\n|merupakan|adalah)',
        r'PROUDLY\s+PRESENTS?(?:!)?\s*([^\n]+?)(?:\n|Pendaftaran|merupakan|adalah)',
        r'proudly\s+presents?(?:!)?\s*([^\n]+?)(?:\n|Pendaftaran|merupakan|adalah)',
    ]

    for pattern in patterns:
        match = re.search(pattern, caption, re.IGNORECASE)
        if match:
            org = match.group(1).strip()
            org = re.sub(r'^(?:diselenggarakan\s+oleh|organized\s+by|hosted\s+by|PROUDLY\s+PRESENTS?|proudly\s+presents?)\s*:\s*', '', org, flags=re.IGNORECASE)
            org = org.strip()
            if len(org) > 3 and len(org) < 150:
                return org[:100]

    # Look for organization names directly
    org_patterns = [
        r'(HIMAPAJAK|Himpunan\s+Mahasiswa\s+Perpajakan)(?:\s+Fakultas)?',
        r'(Fakultas\s+[\w\s]+?)(?:\s|Universitas|\n|,)',
        r'(Universitas\s+[\w\s]+?)(?:\s|\n|,)',
        r'(English\s+Students\s+Association)',
        r'(ESA\s+2025)',
        r'(OSIS\s+[\w\s]+?)(?:\s|proudly|\n|,)',
        r'(BEM\s+[\w\s]+?)(?:\s|\n|,)',
        r'(UKM\s+[\w\s]+?)(?:\s|\n|,)',
        r'(IPB\s+Matematika)',
        r'(AAPG\s+ITB)',
        r'(FPCI\s+Climate\s+Unit)',
        r'(Bisnis\s+Muda)',
        r'(LSPR)',
        r'(Taxion\s+UPNVJ)',
        r'(AMSA)',
        r'(Sistem\s+Informasi\s+[\w\s]+)',
    ]

    for pattern in org_patterns:
        match = re.search(pattern, caption, re.IGNORECASE)
        if match:
            org = match.group(1).strip()
            if len(org) > 3:
                return org[:100]

    return "Not specified"

def extract_date(caption):
    """Extract event date in YYYY-MM-DD format"""
    caption = clean_caption(caption)
    if not caption:
        return "Not specified"

    month_map = {
        'januari': '01', 'january': '01', 'jan': '01',
        'februari': '02', 'february': '02', 'feb': '02',
        'maret': '03', 'march': '03', 'mar': '03',
        'april': '04', 'apr': '04',
        'mei': '05', 'may': '05',
        'juni': '06', 'june': '06', 'jun': '06',
        'juli': '07', 'july': '07', 'jul': '07',
        'agustus': '08', 'august': '08', 'aug': '08',
        'september': '09', 'sep': '09',
        'oktober': '10', 'october': '10', 'oct': '10',
        'november': '11', 'nov': '11',
        'desember': '12', 'december': '12', 'dec': '12'
    }

    # Pattern: DD Month YYYY
    match = re.search(r'(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})', caption, re.IGNORECASE)
    if match:
        day, month_name, year = match.groups()
        month = month_map.get(month_name.lower(), '01')
        return f"{year}-{month}-{day.zfill(2)}"

    # Pattern: Month DD, YYYY
    match = re.search(r'(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})', caption, re.IGNORECASE)
    if match:
        month_name, day, year = match.groups()
        month = month_map.get(month_name.lower(), '01')
        return f"{year}-{month}-{day.zfill(2)}"

    # Try YYYY-MM-DD
    match = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', caption)
    if match:
        return f"{match.group(1)}-{match.group(2).zfill(2)}-{match.group(3).zfill(2)}"

    return "Not specified"

def extract_location(caption):
    """Extract event location"""
    caption = clean_caption(caption)
    if not caption:
        return "Not specified"

    caption_lower = caption.lower()

    # Check for explicit location keywords
    patterns = [
        r'(?:tempat|location|venue|lokasi|place)\s*[:\-]?\s*([^\n📝📅📆💰📞]+?)(?:\n|📝|📅|📆|💰|📞|$)',
        r'pelaksanaan\s*[:\-]?\s*([^\n📝📅📆💰📞]+?)(?:\n|📝|📅|📆|💰|📞|$)',
    ]

    for pattern in patterns:
        match = re.search(pattern, caption, re.IGNORECASE)
        if match:
            loc = match.group(1).strip()
            loc = re.sub(r'\s+', ' ', loc)
            loc = re.sub(r'[^\w\s\-\.\,]+', '', loc)
            if 2 < len(loc) < 100:
                return loc

    # Check for online/offline
    if 'online' in caption_lower and 'offline' not in caption_lower:
        return "Online"
    if 'offline' in caption_lower:
        match = re.search(r'offline\s+(?:di\s+)?([^\n📝📅📆💰📞]+)', caption_lower)
        if match:
            loc = match.group(1).strip()
            loc = re.sub(r'\s+', ' ', loc)
            loc = re.sub(r'[^\w\s\-\.\,]+', '', loc)
            return f"Offline: {loc[:50]}"

    return "Not specified"

def extract_fee(caption):
    """Extract registration fee"""
    caption = clean_caption(caption)
    if not caption:
        return "Not specified"

    # Look for FREE/Gratis
    if re.search(r'\b(FREE|Gratis|gratis|free)\b', caption):
        return "FREE"

    # Look for fee patterns - extract Rp values
    patterns = [
        r'(?:biaya|fee|harga|pendaftaran)\s*(?:gelombang\s+[\w\s]+\s*)?[:\-]?\s*Rp\.?\s*([\d\.]+)',
        r'gelombang\s+[\w\s]+\s*[:\-]?\s*Rp\.?\s*([\d\.]+)',
        r'Rp\.?\s*([\d\.]+)\s*(?:,-|\.)\s*(?:\-|s\.d\.|until)',
    ]

    fees = []
    for pattern in patterns:
        matches = re.finditer(pattern, caption, re.IGNORECASE)
        for match in matches:
            fee = match.group(1)
            # Clean up fee
            fee = re.sub(r'\.', '', fee)
            if fee.isdigit() and int(fee) > 1000:  # Minimum fee of 1000
                fees.append(int(fee))

    if fees:
        min_fee = min(fees)
        max_fee = max(fees)
        if min_fee == max_fee:
            return f"Rp {min_fee:,}"
        else:
            return f"Rp {min_fee:,} - Rp {max_fee:,}"

    return "Not specified"

def extract_contacts(caption):
    """Extract contact persons as JSON array"""
    caption = clean_caption(caption)
    contacts = []

    # Extract phone numbers from caption
    phone_pattern = r'(?:0|\+62|62)(\d{8,12})'
    phone_map = {}  # phone -> name

    # Pattern 1: "Name : Phone" or "Name Telepon : Phone"
    matches = re.finditer(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:Telepon\s*[:]\s*)?[:\-]\s*(?:0|\+62|62)?(\d{8,12})', caption)
    for match in matches:
        name = match.group(1).strip()
        phone = match.group(2)
        if not phone.startswith('0'):
            phone = '0' + phone
        if len(phone) >= 10 and phone not in phone_map:
            phone_map[phone] = name

    # Pattern 2: Look for "wa.me/" links
    wa_matches = re.finditer(r'wa\.me/(\+62|62)?(\d{8,12})', caption)
    for match in wa_matches:
        phone = match.group(2) if match.group(2) else match.group(1)
        if not phone.startswith('0'):
            phone = '0' + phone
        if len(phone) >= 10 and phone not in phone_map:
            phone_map[phone] = "Admin"

    # Pattern 3: Look for standalone phone numbers
    all_phones = re.findall(phone_pattern, caption)
    for phone in all_phones:
        phone = '0' + phone
        if len(phone) >= 10 and phone not in phone_map:
            phone_map[phone] = "Admin"

    # Build contacts array
    for phone, name in phone_map.items():
        contacts.append({"name": name, "phone": phone})

    return json.dumps(contacts, ensure_ascii=False)

# Read and process CSV
with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

parsed_rows = []
for row in rows:
    caption = row.get('original_caption', '')

    # Parse the caption
    title = extract_title(caption)
    organizer = extract_organizer(caption)
    date = extract_date(caption)
    location = extract_location(caption)
    fee = extract_fee(caption)
    contacts = extract_contacts(caption)

    # Update row
    row['extracted_title'] = title
    row['extracted_organizer'] = organizer
    row['extracted_date'] = date
    row['extracted_location'] = location
    row['registration_fee'] = fee
    row['contact_persons'] = contacts
    row['parse_status'] = 'parsed'
    row['parse_timestamp'] = datetime.now().isoformat() + 'Z'
    row['last_edited'] = 'claude'

    parsed_rows.append(row)

# Write parsed CSV
with open(output_file, 'w', encoding='utf-8', newline='') as f:
    fieldnames = [
        'session_id', 'json_file', 'post_index', 'post_url', 'original_caption',
        'extracted_title', 'extracted_organizer', 'extracted_date', 'extracted_location',
        'registration_fee', 'phone_numbers', 'contact_persons', 'parse_status',
        'parse_timestamp', 'last_edited'
    ]
    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    writer.writerows(parsed_rows)

print(f"Parsed {len(parsed_rows)} rows")
print(f"Output saved to: {output_file}")

# Save sample results to file for inspection
with open(r'D:\Hilmi\Coding\WebScraper\parsed\sample_results.txt', 'w', encoding='utf-8') as f:
    for i, row in enumerate(parsed_rows[:5]):
        f.write(f"\n=== Row {i} ===\n")
        f.write(f"Title: {row['extracted_title']}\n")
        f.write(f"Organizer: {row['extracted_organizer']}\n")
        f.write(f"Date: {row['extracted_date']}\n")
        f.write(f"Location: {row['extracted_location']}\n")
        f.write(f"Fee: {row['registration_fee']}\n")
        f.write(f"Contacts: {row['contact_persons']}\n")

print("Sample results saved to sample_results.txt")
