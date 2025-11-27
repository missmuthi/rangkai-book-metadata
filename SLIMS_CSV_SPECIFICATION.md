# SLiMS CSV Export Specification

**Target System:** SLiMS 9 Bulian (and newer)  
**Platform:** Windows Servers  
**Version:** 1.0  
**Date:** 2025-11-27

---

## Overview

This document specifies the exact CSV format required for importing bibliographic data into SLiMS (Senayan Library Management System) version 9 Bulian and newer, running on Windows servers.

---

## 18-Column Schema

The CSV export follows a strict 18-column schema. All columns are **required** (use empty strings `""` for missing data).

| #   | Column Name      | Data Type | Required | Description                           | Example                                                  |
| --- | ---------------- | --------- | -------- | ------------------------------------- | -------------------------------------------------------- |
| 1   | `title`          | String    | Yes      | Main title of the book                | "Clean Code: A Handbook of Agile Software Craftsmanship" |
| 2   | `gmd_name`       | String    | Yes      | General Material Designation          | "Text" or "Art Paper"                                    |
| 3   | `edition`        | String    | No       | Edition statement                     | "1st ed.", "Cet. 1", "Rev. ed."                          |
| 4   | `isbn_issn`      | String    | Yes      | Clean ISBN (no dashes)                | "9780132350884"                                          |
| 5   | `publisher_name` | String    | Yes      | Publisher name only                   | "Prentice Hall"                                          |
| 6   | `publish_year`   | String    | Yes      | 4-digit year                          | "2008"                                                   |
| 7   | `collation`      | String    | No       | Physical description                  | "xx, 432 p. : ill. ; 24 cm"                              |
| 8   | `series_title`   | String    | No       | Series name                           | "Robert C. Martin Series"                                |
| 9   | `call_number`    | String    | Yes      | Call number                           | "005.1 MAR c"                                            |
| 10  | `language_name`  | String    | Yes      | Full language name (NOT ISO codes)    | "English", "Indonesia"                                   |
| 11  | `place_name`     | String    | No       | City of publication                   | "New York", "Jakarta"                                    |
| 12  | `classification` | String    | Yes      | DDC or LCC number                     | "005.1"                                                  |
| 13  | `notes`          | String    | No       | Summary/abstract/notes                | "Presents a revolutionary..."                            |
| 14  | `image`          | String    | No       | Cover image URL                       | "https://covers.openlibrary.org/..."                     |
| 15  | `sor`            | String    | Yes      | Statement of Responsibility           | "Robert C. Martin"                                       |
| 16  | `authors`        | String    | Yes      | Author names (separate with `;`)      | "Robert C. Martin ; Kent Beck"                           |
| 17  | `topics`         | String    | No       | Subjects/Keywords (separate with `;`) | "Programming ; Software Engineering"                     |
| 18  | `item_code`      | String    | No       | Barcode/inventory ID                  | "RNG-2025-00001-32350884"                                |

---

## Technical Requirements

### 1. UTF-8 BOM (CRITICAL)

**The CSV MUST start with the UTF-8 Byte Order Mark (`\uFEFF`).**

SLiMS running on Windows servers will **fail to read special characters** (accents, non-ASCII) without this BOM.

```typescript
const csvContent = generateBatchCSV(books);
const blob = new Blob(["\uFEFF" + csvContent], {
  type: "text/csv;charset=utf-8;",
});
```

### 2. Quoting Rules

**ALL fields MUST be wrapped in double quotes (`""`), even if they don't contain special characters.**

This ensures consistent parsing in SLiMS.

```csv
"Clean Code","Text","1st ed.","9780132350884","Prentice Hall","2008","xx, 432 p.","Robert C. Martin Series","005.1 MAR c","English","New York","005.1","Presents a revolutionary...","https://covers.openlibrary.org/...","Robert C. Martin","Robert C. Martin","Programming ; Software Engineering","RNG-2025-00001"
```

### 3. Quote Escaping

Internal double quotes must be escaped by doubling them:

```typescript
const escapeCSV = (value: string): string => {
  const escaped = String(value).replace(/"/g, '""');
  return `"${escaped}"`;
};
```

**Example:**

- Input: `The "Best" Book`
- Output: `"The ""Best"" Book"`

### 4. Column Delimiter

Use a comma (`,`) as the column separator.

### 5. Row Delimiter

Use a newline (`\n`) as the row separator.

---

## Data Mapping Rules

### Language Names

**SLiMS does NOT accept ISO 639 language codes (e.g., `en`, `id`).**

Use full language names in English or Indonesian:

| ISO Code | Correct Value | Incorrect Value              |
| -------- | ------------- | ---------------------------- |
| `en`     | `English`     | ~~`en`~~                     |
| `id`     | `Indonesia`   | ~~`id`~~ or ~~`Indonesian`~~ |
| `ms`     | `Malay`       | ~~`ms`~~                     |
| `fr`     | `French`      | ~~`fr`~~                     |
| `de`     | `German`      | ~~`de`~~                     |
| `es`     | `Spanish`     | ~~`es`~~                     |

**Implementation:**

```typescript
const mapLanguage = (lang: string): string => {
  const langMap: Record<string, string> = {
    en: "English",
    id: "Indonesia",
    ms: "Malay",
    fr: "French",
    // ...
  };
  return langMap[lang.toLowerCase()] || lang;
};
```

### ISBN Formatting

**Remove all dashes and spaces from ISBNs:**

| Input               | Correct Output  | Incorrect Output        |
| ------------------- | --------------- | ----------------------- |
| `978-0-13-235088-4` | `9780132350884` | ~~`978-0-13-235088-4`~~ |
| `0-13-235088-2`     | `0132350882`    | ~~`0-13-235088-2`~~     |

**Implementation:**

```typescript
const cleanISBN = (isbn: string): string => {
  return isbn.replace(/[-\s]/g, "");
};
```

### Publisher String Parsing

Rangkai stores publisher data as: `"Place : Publisher, Year"`

**Extract components:**

| Source Field     | Extraction Logic     | Example           |
| ---------------- | -------------------- | ----------------- |
| `place_name`     | Before `:`           | `"New York"`      |
| `publisher_name` | Between `:` and `,`  | `"Prentice Hall"` |
| `publish_year`   | After `,` (4 digits) | `"2008"`          |

**Implementation:**

```typescript
const extractPlace = (publisherString: string): string => {
  const parts = publisherString.split(":");
  return parts.length > 1 ? parts[0].trim() : "";
};

const extractPublisher = (publisherString: string): string => {
  const parts = publisherString.split(":");
  if (parts.length > 1) {
    const publisherYear = parts[1].trim();
    return publisherYear.split(",")[0].trim();
  }
  return "";
};

const extractYear = (publisherString: string): string => {
  const match = publisherString.match(/,\s*(\d{4})/);
  return match ? match[1] : "";
};
```

### Multiple Authors/Subjects

Separate multiple authors or subjects with `;` (space-semicolon-space):

```csv
"Robert C. Martin ; Kent Beck ; Martin Fowler"
"Programming ; Software Engineering ; Agile Development"
```

**Note:** SLiMS can be picky about separators. The space-semicolon-space format is most reliable.

### Item Code (Barcode) Generation

Generate unique barcodes using the format: `RNG-YYYY-XXXXX`

**Batch Export:**

```typescript
const generateItemCode = (index: number): string => {
  const year = new Date().getFullYear();
  const sequence = String(index + 1).padStart(5, "0");
  return `RNG-${year}-${sequence}`;
};
```

**Single Export:**

```typescript
const generateItemCode = (isbn: string): string => {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-5);
  const isbnSuffix = isbn ? `-${isbn.slice(-8)}` : "";
  return `RNG-${year}-${timestamp}${isbnSuffix}`;
};
```

### Classification Fallback

Use `classification` field if available, otherwise fallback to `ddc`:

```typescript
const classification =
  data.classification !== "NONE" ? data.classification : data.ddc;
```

### Cover Image URLs

Only include valid, accessible URLs. Exclude placeholder images:

```typescript
const coverUrl =
  data.cover && data.cover !== "/placeholder-book.png" ? data.cover : "";
```

---

## Example CSV Output

### Header Row

```csv
title,gmd_name,edition,isbn_issn,publisher_name,publish_year,collation,series_title,call_number,language_name,place_name,classification,notes,image,sor,authors,topics,item_code
```

### Data Row (Single Book)

```csv
"Clean Code: A Handbook of Agile Software Craftsmanship","Text","1st ed.","9780132350884","Prentice Hall","2008","xx, 432 p. : ill. ; 24 cm","Robert C. Martin Series","005.1 MAR c","English","Upper Saddle River","005.1","Presents a revolutionary paradigm with Clean Code, a handbook of agile software craftsmanship.","https://covers.openlibrary.org/b/id/12345-L.jpg","Robert C. Martin","Robert C. Martin","Programming ; Software Engineering ; Clean Code","RNG-2025-00001-32350884"
```

### Complete Example (3 Books)

```csv
title,gmd_name,edition,isbn_issn,publisher_name,publish_year,collation,series_title,call_number,language_name,place_name,classification,notes,image,sor,authors,topics,item_code
"Clean Code: A Handbook of Agile Software Craftsmanship","Text","1st ed.","9780132350884","Prentice Hall","2008","xx, 432 p. : ill. ; 24 cm","Robert C. Martin Series","005.1 MAR c","English","Upper Saddle River","005.1","Presents a revolutionary paradigm with Clean Code.","https://covers.openlibrary.org/b/id/12345-L.jpg","Robert C. Martin","Robert C. Martin","Programming ; Software Engineering","RNG-2025-00001"
"Design Patterns","Text","","0201633612","Addison-Wesley","1994","xiv, 395 p. : ill. ; 24 cm","","005.1 GAM d","English","Reading","005.1","Classic book on design patterns in object-oriented programming.","https://covers.openlibrary.org/b/id/67890-L.jpg","Erich Gamma ; Richard Helm ; Ralph Johnson ; John Vlissides","Erich Gamma ; Richard Helm ; Ralph Johnson ; John Vlissides","Object-Oriented Programming ; Design Patterns","RNG-2025-00002"
"Refactoring","Text","2nd ed.","9780134757599","Addison-Wesley","2018","xxiv, 418 p. : ill. ; 24 cm","","005.1 FOW r","English","Boston","005.1","Improving the design of existing code with refactoring techniques.","https://covers.openlibrary.org/b/id/11111-L.jpg","Martin Fowler","Martin Fowler ; Kent Beck","Software Engineering ; Refactoring ; Code Quality","RNG-2025-00003"
```

---

## File Naming Convention

**Batch Export:**

```
rangkai_batch_[YYYY-MM-DD]_[Count].csv
```

**Examples:**

- `rangkai_batch_2025-11-27_50.csv` (50 books exported on Nov 27, 2025)
- `rangkai_batch_2025-12-01_123.csv` (123 books exported on Dec 1, 2025)

**Single Book Export:**

```
slims_[ISBN]_[Timestamp].csv
```

**Examples:**

- `slims_9780132350884_1732677814.csv`
- `slims_book_1732677814.csv` (if no ISBN)

---

## Import to SLiMS

### Steps

1. **Export CSV from Rangkai**
   - Click "Export X Books" button in Scanner Mode
   - File downloads automatically with UTF-8 BOM

2. **Open SLiMS Admin Panel**
   - Navigate to: `Bibliography > Import Data`

3. **Upload CSV File**
   - Select the exported CSV file
   - Choose: `CSV (Comma-Separated Values)`
   - Encoding: `UTF-8` (auto-detected via BOM)

4. **Map Columns**
   - SLiMS will auto-detect column names
   - Verify mapping matches the 18-column schema

5. **Import**
   - Click "Import" to process records
   - Review import log for any errors

### Common Import Errors

| Error                    | Cause                       | Solution                            |
| ------------------------ | --------------------------- | ----------------------------------- |
| "Invalid encoding"       | Missing UTF-8 BOM           | Ensure `\uFEFF` is prepended to CSV |
| "Language not found"     | ISO code used (e.g., `en`)  | Use full name (e.g., `English`)     |
| "Invalid ISBN format"    | Dashes in ISBN              | Remove dashes: `9780132350884`      |
| "Duplicate item_code"    | Same barcode used twice     | Use sequential item codes           |
| "Publisher format error" | Full `publisherString` used | Extract publisher name only         |

---

## Validation Checklist

Before importing to SLiMS, verify:

- [ ] UTF-8 BOM (`\uFEFF`) is at the start of the file
- [ ] All 18 columns are present in the header row
- [ ] All fields are wrapped in double quotes (`""`)
- [ ] Internal quotes are escaped (`""`)
- [ ] ISBNs have no dashes or spaces
- [ ] Language is full name (NOT ISO code like `en` or `id`)
- [ ] Publisher is name only (not `Place : Publisher, Year`)
- [ ] Year is 4 digits (not full date)
- [ ] Multiple authors/subjects use `;` separator
- [ ] Item codes are unique across all rows
- [ ] Cover URLs are valid and accessible

---

## Troubleshooting

### Special Characters Not Displaying

**Symptom:** Accented characters (é, ñ, ü) show as `�` or garbled text in SLiMS.

**Cause:** Missing UTF-8 BOM.

**Solution:** Ensure the CSV starts with `\uFEFF`:

```typescript
const blob = new Blob(["\uFEFF" + csvContent], {
  type: "text/csv;charset=utf-8;",
});
```

### Language Field Rejected

**Symptom:** SLiMS shows "Language not found in database" error.

**Cause:** ISO language codes used instead of full names.

**Solution:** Map ISO codes to full names:

```typescript
'en' → 'English'
'id' → 'Indonesia'
```

### Publisher Data Not Imported

**Symptom:** Publisher field is empty in SLiMS.

**Cause:** Full `publisherString` format (`Place : Publisher, Year`) used instead of publisher name only.

**Solution:** Extract publisher name:

```typescript
"New York : Prentice Hall, 2008" → "Prentice Hall"
```

### Duplicate Barcode Error

**Symptom:** SLiMS rejects import due to duplicate `item_code`.

**Cause:** Item codes not unique.

**Solution:** Use sequential generation:

```typescript
RNG-2025-00001
RNG-2025-00002
RNG-2025-00003
```

---

## Implementation Reference

See `src/lib/export.ts` for the complete implementation:

- `generateBatchCSV()` - Batch export with 18-column schema
- `generateSLiMSCSV()` - Single book export with 18-column schema
- `exportBatchToSLiMSCSV()` - Trigger download with UTF-8 BOM

---

## Version History

| Version | Date       | Changes                                 |
| ------- | ---------- | --------------------------------------- |
| 1.0     | 2025-11-27 | Initial 18-column schema implementation |

---

## References

- SLiMS Official Documentation: https://slims.web.id/
- SLiMS 9 Bulian Release Notes: https://github.com/slims/slims9_bulian
- UTF-8 BOM Specification: https://en.wikipedia.org/wiki/Byte_order_mark
- MARC21 Standards: https://www.loc.gov/marc/

---

**Status:** PRODUCTION READY ✅
