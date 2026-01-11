import csv
import json
import re
from datetime import datetime

# Read the CSV file
input_file = r'D:\Hilmi\Coding\WebScraper\parsed\parsed-304b7acd-1768128145689.csv'
output_file = r'D:\Hilmi\Coding\WebScraper\parsed\parsed-304b7acd-1768128145689-parsed.csv'

def extract_title(caption):
    """Extract event title from caption"""
    # Remove the Instagram prefix
    caption = re.sub(r'^\d+\s+(likes|comments).*?:\s*"', '', caption)
    caption = re.sub(r'^"', '', caption)

    # Look for title patterns
    patterns = [
        r'\[?\s*(OPEN REGISTRATION.*?)\s*\]?\s*\n',
        r'(LOMBA.*?)(?:\n|📆|📍|💰|📞)',
        r'(COMPETITION.*?)(?:\n|📆|📍|💰|📞)',
        r'(COMPETISI.*?)(?:\n|📆|📍|💰|📞)',
        r'(KOMPETISI.*?)(?:\n|📆|📍|💰|📞)',
        r'\[?\s*(.*?)\s*\]?.*?PROUDLY PRESENT',
    ]

    for pattern in patterns:
        match = re.search(pattern, caption, re.IGNORECASE | re.DOTALL)
        if match:
            title = match.group(1).strip()
            # Clean up title
            title = re.sub(r'\s+', ' ', title)
            title = title.strip()
            if 5 < len(title) < 150:
                return title

    # Get first meaningful line
    lines = caption.split('\n')
    for line in lines[:5]:
        line = line.strip()
        if line and 5 < len(line) < 150:
            return line[:100]

    return "Not specified"

def extract_organizer(caption):
    """Extract organizer from caption"""
    patterns = [
        r'(?:diselenggarakan oleh|organized by|hosted by|presented by)\s*:\s*([^\n.]+)',
        r'PROUDLY PRESENTS?\s*([^\n]+)',
        r'proudly presents?\s*([^\n]+)',
        r'(?:HIMAPAJAK|Himpunan Mahasiswa Perpajakan|Universitas Brawijaya|Universitas|UKM|OSIS SMA|SMA PU|BEM|DEPARTEMEN|English Students Association|ESA|IPB|ITB|UB|UPNVJ|UKSW|UM|AMSA|FPCI|Bisnis Muda|LSPR|Sistem Informasi|Taxion|AAPG|Wildcat)[^\n]*',
    ]

    for pattern in patterns:
        match = re.search(pattern, caption, re.IGNORECASE)
        if match:
            org = match.group(0)
            # Clean up
            org = re.sub(r'^(?:diselenggarakan oleh|organized by|hosted by|presented by|PROUDLY PRESENTS?|proudly presents?)\s*:\s*', '', org, flags=re.IGNORECASE)
            org = org.strip()
            if len(org) > 3:
                return org[:100]

    return "Not specified"

def extract_date(caption):
    """Extract event date in YYYY-MM-DD format"""
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

    # Pattern: DD Month YYYY or Month DD, YYYY
    pattern1 = r'(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})'
    pattern2 = r'(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})'

    for pattern in [pattern1, pattern2]:
        matches = re.finditer(pattern, caption, re.IGNORECASE)
        for match in matches:
            groups = match.groups()
            if len(groups) == 3:
                if groups[0].isdigit():  # DD Month YYYY
                    day, month_name, year = groups
                    month = month_map.get(month_name.lower(), '01')
                    return f"{year}-{month}-{day.zfill(2)}"
                else:  # Month DD, YYYY
                    month_name, day, year = groups
                    month = month_map.get(month_name.lower(), '01')
                    return f"{year}-{month}-{day.zfill(2)}"

    # Try YYYY-MM-DD
    match = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', caption)
    if match:
        return f"{match.group(1)}-{match.group(2).zfill(2)}-{match.group(3).zfill(2)}"

    return "Not specified"

def extract_location(caption):
    """Extract event location"""
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
            if 2 < len(loc) < 100:
                return loc

    # Check for online/offline
    if 'online' in caption_lower:
        return "Online"
    if re.search(r'offline\s+di\s+([^\n]+)', caption_lower):
        match = re.search(r'offline\s+di\s+([^\n📝📅📆💰📞]+)', caption_lower)
        if match:
            return f"Offline: {match.group(1).strip()}"

    return "Not specified"

def extract_fee(caption):
    """Extract registration fee"""
    # Look for FREE/Gratis
    if re.search(r'\b(FREE|Gratis|gratis|free)\b', caption):
        return "FREE"

    # Look for fee patterns
    patterns = [
        r'(?:biaya|fee|harga|pendaftaran)\s*[:\-]?\s*Rp\.?\s*([\d\.]+)',
        r'gelombang\s*\d+\s*[:\-]?\s*Rp\.?\s*([\d\.]+)',
    ]

    for pattern in patterns:
        matches = re.finditer(pattern, caption, re.IGNORECASE)
        for match in matches:
            fee = match.group(1)
            # Clean up fee
            fee = re.sub(r'\.', '', fee)
            if fee.isdigit() and len(fee) >= 3:
                return f"Rp {fee}"

    # Look for range
    match = re.search(r'Rp\.?\s*([\d\.]+)\s*-\s*Rp\.?\s*([\d\.]+)', caption)
    if match:
        return f"Rp {match.group(1)} - Rp {match.group(2)}"

    return "Not specified"

def extract_contacts(caption, phone_numbers):
    """Extract contact persons as JSON array"""
    contacts = []

    # Normalize phone numbers
    phone_list = []
    if phone_numbers:
        for p in phone_numbers.split(';'):
            p = p.strip()
            if p and len(p) >= 10:
                phone_list.append(p)

    # Look for contact person patterns with names and phones
    patterns = [
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[:\-]\s*(?:0|8|\+62|62)(\d{8,12})',
        r'(?:CP|Contact Person|Narahubung|Contact|Hubungi)\s*[:\-]?\s*([^\n]+)',
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:wa\.me/|\()?\s*(?:0|8|\+62|62)(\d{8,12})',
    ]

    seen_phones = set()

    for pattern in patterns:
        matches = re.finditer(pattern, caption, re.MULTILINE)
        for match in matches:
            if len(match.groups()) == 2:
                name, phone = match.groups()
                phone = '0' + phone if not phone.startswith('0') else phone
                if phone not in seen_phones and len(phone) >= 10:
                    contacts.append({"name": name.strip(), "phone": phone})
                    seen_phones.add(phone)
            elif len(match.groups()) == 1:
                contact_text = match.group(1)
                # Look for phone in the text
                phone_match = re.search(r'(?:0|8|\+62|62)(\d{8,12})', contact_text)
                if phone_match:
                    phone = '0' + phone_match.group(1) if not phone_match.group(0).startswith('0') else phone_match.group(0)
                    name_match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', contact_text)
                    name = name_match.group(1) if name_match else "Admin"
                    if phone not in seen_phones and len(phone) >= 10:
                        contacts.append({"name": name.strip(), "phone": phone})
                        seen_phones.add(phone)

    # Add remaining phones as Admin
    for phone in phone_list:
        normalized = phone
        if phone.startswith('+62'):
            normalized = '0' + phone[3:]
        elif phone.startswith('62') and not phone.startswith('620'):
            normalized = '0' + phone[2:]

        if normalized not in seen_phones and len(normalized) >= 10:
            contacts.append({"name": "Admin", "phone": normalized})
            seen_phones.add(normalized)

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

# Print first few parsed results for verification
print("\n--- Sample Parsed Results ---")
for i, row in enumerate(parsed_rows[:3]):
    print(f"\nRow {i}:")
    print(f"  Title: {row['extracted_title']}")
    print(f"  Organizer: {row['extracted_organizer']}")
    print(f"  Date: {row['extracted_date']}")
    print(f"  Location: {row['extracted_location']}")
    print(f"  Fee: {row['registration_fee']}")
    print(f"  Contacts: {row['contact_persons']}")
