import csv
import json
import re
from datetime import datetime

# Read the CSV file
input_file = r'D:\Hilmi\Coding\WebScraper\parsed\parsed-304b7acd-1768128145689.csv'
output_file = r'D:\Hilmi\Coding\WebScraper\parsed\parsed-304b7acd-1768128145689-parsed.csv'

def clean_caption(caption):
    """Clean the Instagram caption format"""
    # Remove the prefix "X likes, Y comments - username on date: "
    caption = re.sub(r'^\d+\s+(?:likes|comments).*?:\s*"', '', caption)
    caption = re.sub(r'^"', '', caption)
    caption = re.sub(r'"\.$', '', caption)  # Remove trailing quote and dot
    return caption.strip()

def extract_title(caption):
    """Extract event title from caption"""
    caption = clean_caption(caption)

    # Look for specific title patterns
    patterns = [
        r'\[\s*OPEN REGISTRATION\s+(.*?)\s*\]',
        r'\[\s*OPEN\s+REGISTRATION\s+(.*?)\s*\]',
        r'OPEN REGISTRATION\s+(.*?)(?:\n|📆|📍|💰|📞|$)',
        r'(LOMBAs?\s+.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'(COMPETITION\s+.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'(COMPETISI\s+.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'(KOMPETISI\s+.*?)(?:\n|📆|📍|💰|📞|merupakan|adalah)',
        r'\[?\s*(.*?)\s*\]?\s*PROUDLY PRESENT',
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

    patterns = [
        r'(?:diselenggarakan\s+oleh|organized\s+by|hosted\s+by|presented\s+by)\s*:\s*([^\n\.]+?)(?:\.|\n|merupakan|adalah)',
        r'PROUDLY\s+PRESENTS?(?:!)?\s*([^\n]+?)(?:\n|Pendaftaran|merupakan)',
        r'proudly\s+presents?(?:!)?\s*([^\n]+?)(?:\n|Pendaftaran|merupakan)',
        r'(HIMAPAJAK|Himpunan\s+Mahasiswa\s+Perpajakan|Fakultas\s+Ilmu\s+Administrasi|Universitas\s+Brawijaya|Universitas\s+[\w\s]+?|UKM\s+[\w\s]+?|OSIS\s+[\w\s]+?|BEM\s+[\w\s]+?|DEPARTEMEN\s+[\w\s]+?|English\s+Students\s+Association|ESA|IPB|ITB|UB|UPNVJ|UKSW|UM|AMSA|FPCI|Bisnis\s+Muda|LSPR|Sistem\s+Informasi|Taxion|AAPG|Wildcat\s+AAPG)(?:\s|\.)',
    ]

    for pattern in patterns:
        match = re.search(pattern, caption, re.IGNORECASE)
        if match:
            org = match.group(1).strip()
            # Clean up
            org = re.sub(r'^(?:diselenggarakan\s+oleh|organized\s+by|hosted\s+by|presented\s+by|PROUDLY\s+PRESENTS?|proudly\s+presents?)\s*:\s*', '', org, flags=re.IGNORECASE)
            org = org.strip()
            if len(org) > 3:
                return org[:100]

    return "Not specified"

def extract_date(caption):
    """Extract event date in YYYY-MM-DD format"""
    caption = clean_caption(caption)

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

    # Look for FREE/Gratis
    if re.search(r'\b(FREE|Gratis|gratis|free)\b', caption):
        return "FREE"

    # Look for fee patterns
    patterns = [
        r'(?:biaya|fee|harga|pendaftaran)\s*(?:gelombang\s+\w+\s*)?[:\-]?\s*Rp\.?\s*([\d\.]+)',
        r'gelombang\s+\w+\s*[:\-]?\s*Rp\.?\s*([\d\.]+)',
        r'Rp\.?\s*([\d\.]+)\s*(?:,-|\.)',
    ]

    fees = []
    for pattern in patterns:
        matches = re.finditer(pattern, caption, re.IGNORECASE)
        for match in matches:
            fee = match.group(1)
            # Clean up fee
            fee = re.sub(r'\.', '', fee)
            if fee.isdigit() and int(fee) > 0:
                fees.append(int(fee))

    if fees:
        min_fee = min(fees)
        max_fee = max(fees)
        if min_fee == max_fee:
            return f"Rp {min_fee:,}"
        else:
            return f"Rp {min_fee:,} - Rp {max_fee:,}"

    return "Not specified"

def extract_contacts(caption, phone_numbers):
    """Extract contact persons as JSON array"""
    caption = clean_caption(caption)
    contacts = []

    # Normalize phone numbers from the phone_numbers column
    phone_list = []
    if phone_numbers:
        for p in phone_numbers.split(';'):
            p = p.strip()
            if p and len(p) >= 10:
                # Normalize to 0xxx format
                if p.startswith('+62'):
                    p = '0' + p[3:]
                elif p.startswith('62') and not p.startswith('620'):
                    p = '0' + p[2:]
                phone_list.append(p)

    # Look for contact person patterns: Name : Phone or Name Phone
    # Pattern 1: "Name : Phone"
    matches = re.finditer(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[:\-]\s*(?:Telepon\s*[:]\s*)?0?(\d{8,12})', caption)
    for match in matches:
        name = match.group(1).strip()
        phone = '0' + match.group(2) if not match.group(2).startswith('0') else match.group(2)
        if len(phone) >= 10 and not any(c['phone'] == phone for c in contacts):
            contacts.append({"name": name, "phone": phone})

    # Pattern 2: "Contact Person:" followed by name-phone pairs
    cp_match = re.search(r'(?:CP|Contact\s+Person|Narahubung)\s*[:\-]\s*(.*?)(?:\n\n|📞|$)', caption, re.IGNORECASE | re.DOTALL)
    if cp_match:
        cp_text = cp_match.group(1)
        # Extract name-phone pairs from this text
        for match in re.finditer(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:Telepon\s*[:]\s*)?(?:0|8|\+62)?(\d{8,12})', cp_text):
            name = match.group(1).strip()
            phone = match.group(2)
            if not phone.startswith('0'):
                phone = '0' + phone
            if len(phone) >= 10 and not any(c['phone'] == phone for c in contacts):
                contacts.append({"name": name, "phone": phone})

    # Add remaining phones from phone_numbers column as Admin
    for phone in phone_list:
        if not any(c['phone'] == phone for c in contacts):
            contacts.append({"name": "Admin", "phone": phone})

    return json.dumps(contacts, ensure_ascii=False)

# Read and process CSV
with open(input_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

parsed_rows = []
for row in rows:
    caption = row['original_caption']
    phone_numbers = row['phone_numbers']

    # Parse the caption
    title = extract_title(caption)
    organizer = extract_organizer(caption)
    date = extract_date(caption)
    location = extract_location(caption)
    fee = extract_fee(caption)
    contacts = extract_contacts(caption, phone_numbers)

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
    fieldnames = parsed_rows[0].keys() if parsed_rows else []
    writer = csv.DictWriter(f, fieldnames=fieldnames)
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
        f.write(f"Caption: {row['original_caption'][:200]}...\n")

print("Sample results saved to sample_results.txt")
