# Quick Guide: Import Rangkai CSV to SLiMS

**Target:** SLiMS 9 Bulian (Windows Server)  
**Format:** 18-Column CSV with UTF-8 BOM

---

## Step 1: Export from Rangkai

### Batch Export (Multiple Books)

1. Enable **Scanner Mode** (toggle in search bar)
2. Enable **Auto-Add to Batch** (checkbox)
3. Scan ISBNs continuously
4. Click **"Export X Books"** button in sidebar
5. File downloads: `rangkai_batch_2025-11-27_50.csv`

### Single Book Export

1. Search for a book by ISBN or title
2. Click **"Download SLiMS CSV"** button
3. File downloads: `slims_9780132350884_timestamp.csv`

---

## Step 2: Verify CSV File

Open the CSV in a text editor (NOT Excel) and check:

✅ File starts with invisible BOM character (`\uFEFF`)  
✅ Header row has 18 columns  
✅ All fields wrapped in double quotes `""`  
✅ Language is full name (e.g., `"English"` not `"en"`)  
✅ ISBN has no dashes (e.g., `"9780132350884"`)

**Example First Line:**

```csv
title,gmd_name,edition,isbn_issn,publisher_name,publish_year,collation,series_title,call_number,language_name,place_name,classification,notes,image,sor,authors,topics,item_code
```

---

## Step 3: Import to SLiMS

### Access Import Module

1. Log in to SLiMS admin panel
2. Navigate to: **Bibliography → Import Data**

### Upload CSV

1. Click **"Choose File"**
2. Select your `rangkai_batch_*.csv` file
3. Choose format: **CSV (Comma-Separated Values)**
4. Encoding: **UTF-8** (auto-detected via BOM)
5. Click **"Next"**

### Map Columns (Auto-detected)

SLiMS should automatically map columns:

- `title` → Title
- `gmd_name` → GMD
- `edition` → Edition
- `isbn_issn` → ISBN/ISSN
- `publisher_name` → Publisher
- `publish_year` → Publish Year
- `collation` → Collation
- `series_title` → Series Title
- `call_number` → Call Number
- `language_name` → Language
- `place_name` → Place of Publication
- `classification` → Classification
- `notes` → Notes
- `image` → Cover Image
- `sor` → Statement of Responsibility
- `authors` → Authors
- `topics` → Topics/Subjects
- `item_code` → Item Code/Barcode

### Import Options

- **Import Type:** Select "Bibliographic Records"
- **Duplicate Check:** Check "ISBN/ISSN"
- **Action on Duplicate:** "Skip" or "Update"
- Click **"Import"**

---

## Step 4: Verify Import

### Check Import Log

1. Review the import summary:
   - **Success:** X records imported
   - **Skipped:** Y duplicates
   - **Errors:** 0 (ideally)

2. If errors occur, check:
   - Language field (must be full name, not ISO code)
   - ISBN format (no dashes)
   - Special characters (ensure UTF-8 BOM present)

### Browse Imported Books

1. Navigate to: **Bibliography → Browse**
2. Search for recently imported books
3. Verify:
   - Title displays correctly
   - Author names are correct
   - ISBN is clean (no dashes)
   - Language shows full name
   - Cover image loads
   - Classification (DDC/LCC) is correct

---

## Troubleshooting

### Issue: Special Characters Display as �

**Cause:** Missing UTF-8 BOM  
**Solution:** Ensure Rangkai export includes BOM (already implemented)

**Verify BOM in file:**

```bash
# Linux/Mac
hexdump -C rangkai_batch_*.csv | head -1
# Should show: ef bb bf (UTF-8 BOM)
```

### Issue: Language Field Rejected

**Error Message:** "Language 'en' not found in database"

**Cause:** ISO language code used instead of full name  
**Solution:** Rangkai already maps codes to full names:

- `en` → `English`
- `id` → `Indonesia`

**Verify in CSV:**

```csv
"English"  ✅ Correct
"en"       ❌ Incorrect
```

### Issue: Publisher Field Empty

**Cause:** Full publisher string format used  
**Solution:** Rangkai already extracts publisher name from `"Place : Publisher, Year"` format

**Verify in CSV:**

```csv
"Prentice Hall"                    ✅ Correct
"New York : Prentice Hall, 2008"   ❌ Incorrect
```

### Issue: Duplicate Barcode Error

**Error Message:** "Item code 'RNG-2025-00001' already exists"

**Cause:** Re-importing same CSV or duplicate codes  
**Solution:**

1. Use "Skip" on duplicate action
2. Or delete old imports before re-importing
3. Rangkai generates unique codes per export

---

## Example Import (3 Books)

### Export Details

- **File:** `rangkai_batch_2025-11-27_3.csv`
- **Books:**
  1. Clean Code (ISBN: 9780132350884)
  2. Design Patterns (ISBN: 0201633612)
  3. Refactoring (ISBN: 9780134757599)

### Import Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Import Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Total Records:     3
 Successfully Imported: 3
 Duplicates Skipped:    0
 Errors:                0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Imported Records Preview

```
1. Clean Code: A Handbook of Agile Software Craftsmanship
   Author: Robert C. Martin
   ISBN: 9780132350884
   Call Number: 005.1 MAR c
   Language: English
   Item Code: RNG-2025-00001

2. Design Patterns
   Author: Erich Gamma ; Richard Helm ; Ralph Johnson ; John Vlissides
   ISBN: 0201633612
   Call Number: 005.1 GAM d
   Language: English
   Item Code: RNG-2025-00002

3. Refactoring
   Author: Martin Fowler ; Kent Beck
   ISBN: 9780134757599
   Call Number: 005.1 FOW r
   Language: English
   Item Code: RNG-2025-00003
```

---

## Best Practices

### Before Import

1. **Scan in Batches:** Group by subject or collection
2. **Verify Metadata:** Check critical fields (Title, Author, ISBN)
3. **Test Small:** Import 5-10 books first to verify format

### During Import

1. **Check Mappings:** Verify column auto-detection is correct
2. **Set Duplicate Action:** Use "Skip" to avoid overwrites
3. **Monitor Progress:** Watch import log for errors

### After Import

1. **Verify Random Sample:** Check 10% of imported books
2. **Check Special Characters:** Verify accents display correctly
3. **Test Search:** Ensure books are searchable
4. **Verify Covers:** Check if cover images load

---

## Performance Tips

### Large Batches (50+ books)

- **Split into smaller files:** 25-50 books per CSV
- **Import during off-hours:** Reduce server load
- **Check server timeout:** Increase if needed

### Network Optimization

- **Pre-download covers:** Use Rangkai's image proxy
- **Verify URLs:** Ensure cover image URLs are accessible
- **Cache images:** SLiMS will cache after first load

---

## Support Resources

### SLiMS Documentation

- Official Docs: https://slims.web.id/
- GitHub: https://github.com/slims/slims9_bulian
- Forum: https://slims.web.id/forum

### Rangkai Documentation

- CSV Specification: `SLIMS_CSV_SPECIFICATION.md`
- Implementation Details: `IMPLEMENTATION_SUMMARY.md`
- Phase 1 Features: `PHASE1_HERO_FEATURES.md`

---

**Last Updated:** 2025-11-27  
**Tested With:** SLiMS 9 Bulian on Windows Server 2019
