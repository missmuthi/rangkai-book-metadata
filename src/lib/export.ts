/**
 * Export utilities for SLiMS CSV and MARCXML formats
 * Transforms MergedBookData into standard library catalog formats
 */

import type { MergedBookData } from "./types";

/**
 * Generate SLiMS 9 Bulian compatible CSV export (18-column schema)
 *
 * 18-Column Schema (STRICT SLiMS compatibility):
 * 1. title - Main title of the book
 * 2. gmd_name - General Material Designation (e.g., "Text", "Art Paper")
 * 3. edition - Edition statement (e.g., "1st ed.", "Cet. 1")
 * 4. isbn_issn - Clean ISBN without dashes
 * 5. publisher_name - Publisher name only
 * 6. publish_year - 4-digit year
 * 7. collation - Physical description (e.g., "xx, 432 p. : ill. ; 24 cm")
 * 8. series_title - Series name
 * 9. call_number - Call number (e.g., "005.1 MAR c")
 * 10. language_name - Full language name (NOT ISO codes)
 * 11. place_name - City of publication
 * 12. classification - DDC Number
 * 13. notes - General notes/summary
 * 14. image - Cover image URL
 * 15. sor - Statement of Responsibility (author name)
 * 16. authors - Author names (separate with ; if multiple)
 * 17. topics - Subjects/Keywords (separate with ;)
 * 18. item_code - Barcode/inventory ID (optional)
 *
 * @param data - MergedBookData object to export
 * @returns CSV string with headers and data row
 */
export function generateSLiMSCSV(data: MergedBookData): string {
  // SLiMS 9 Bulian Standard Headers (18 columns)
  const headers = [
    "title",
    "gmd_name",
    "edition",
    "isbn_issn",
    "publisher_name",
    "publish_year",
    "collation",
    "series_title",
    "call_number",
    "language_name",
    "place_name",
    "classification",
    "notes",
    "image",
    "sor",
    "authors",
    "topics",
    "item_code",
  ];

  /**
   * Escape and quote CSV values (SLiMS Windows compatibility)
   * - ALL fields must be wrapped in double quotes
   * - Internal quotes are escaped by doubling them
   */
  const escapeCSV = (value: string | undefined | null): string => {
    if (!value || value === "-") return '""';

    // Convert to string and escape internal quotes
    const escaped = String(value).replace(/"/g, '""');

    // Always wrap in quotes for SLiMS compatibility
    return `"${escaped}"`;
  };

  /**
   * Clean ISBN: Remove dashes and spaces
   */
  const cleanISBN = (isbn: string | undefined | null): string => {
    if (!isbn || isbn === "-") return "";
    return isbn.replace(/[-\s]/g, "");
  };

  /**
   * Extract place name from publisherString
   * Format: "Place : Publisher, Year"
   */
  const extractPlace = (publisherString: string): string => {
    if (!publisherString || publisherString === "-") return "";
    const parts = publisherString.split(":");
    return parts.length > 1 ? parts[0].trim() : "";
  };

  /**
   * Extract publisher name from publisherString
   * Format: "Place : Publisher, Year"
   */
  const extractPublisher = (
    publisherString: string,
    fallbackPublisher: string,
  ): string => {
    if (!publisherString || publisherString === "-")
      return fallbackPublisher || "";
    const parts = publisherString.split(":");
    if (parts.length > 1) {
      // Extract "Publisher, Year" and remove year
      const publisherYear = parts[1].trim();
      return publisherYear.split(",")[0].trim();
    }
    return fallbackPublisher || "";
  };

  /**
   * Extract year from date field (YYYY-MM-DD or publisherString)
   */
  const extractYear = (date: string, publisherString: string): string => {
    if (date && date !== "-") {
      const year = date.split("-")[0];
      if (year.length === 4) return year;
    }

    // Fallback: extract from publisherString
    if (publisherString && publisherString !== "-") {
      const match = publisherString.match(/,\s*(\d{4})/);
      if (match) return match[1];
    }

    return "";
  };

  /**
   * Map language codes to full names (SLiMS requirement)
   */
  const mapLanguage = (lang: string): string => {
    if (!lang || lang === "-") return "English";

    const langLower = lang.toLowerCase();
    const langMap: Record<string, string> = {
      en: "English",
      english: "English",
      id: "Indonesia",
      indonesia: "Indonesia",
      indonesian: "Indonesia",
      ms: "Malay",
      malay: "Malay",
      fr: "French",
      french: "French",
      de: "German",
      german: "German",
      es: "Spanish",
      spanish: "Spanish",
      ar: "Arabic",
      arabic: "Arabic",
      zh: "Chinese",
      chinese: "Chinese",
      ja: "Japanese",
      japanese: "Japanese",
      ko: "Korean",
      korean: "Korean",
    };

    return langMap[langLower] || lang;
  };

  /**
   * Generate unique item code (barcode)
   * Format: RNG-YYYY-XXXXX-ISBN (e.g., RNG-2025-00001-9780132350884)
   */
  const generateItemCode = (isbn: string): string => {
    const year = new Date().getFullYear();
    const timestamp = Date.now().toString().slice(-5);
    const isbnSuffix = isbn ? `-${isbn.slice(-8)}` : "";
    return `RNG-${year}-${timestamp}${isbnSuffix}`;
  };

  // Build data row
  const cleanedISBN = cleanISBN(data.isbn13 || data.isbn10);
  const place = extractPlace(data.publisherString);
  const publisher = extractPublisher(data.publisherString, data.publisher);
  const year = extractYear(data.date, data.publisherString);
  const language = mapLanguage(data.language);
  const coverUrl =
    data.cover && data.cover !== "/placeholder-book.png" ? data.cover : "";

  const row = [
    escapeCSV(data.title),
    escapeCSV(data.gmd || "Text"),
    escapeCSV(data.edition),
    escapeCSV(cleanedISBN),
    escapeCSV(publisher),
    escapeCSV(year),
    escapeCSV(data.collation),
    escapeCSV(data.series),
    escapeCSV(data.callNumber),
    escapeCSV(language),
    escapeCSV(place),
    escapeCSV(data.classification !== "NONE" ? data.classification : data.ddc),
    escapeCSV(data.description),
    escapeCSV(coverUrl),
    escapeCSV(data.author), // sor (Statement of Responsibility)
    escapeCSV(data.author), // authors
    escapeCSV(data.subjects), // topics
    escapeCSV(generateItemCode(cleanedISBN)), // item_code
  ];

  // Combine headers and row
  return headers.join(",") + "\n" + row.join(",");
}

/**
 * Generate MARCXML export (MARC21 format in XML)
 *
 * MARC21 is the international standard for bibliographic data.
 * MARCXML is the XML representation of MARC21 records.
 *
 * Key MARC fields:
 * - Leader: Record metadata
 * - 001: Control number
 * - 008: Fixed-length data elements
 * - 020: ISBN
 * - 050: Library of Congress Call Number
 * - 082: Dewey Decimal Classification
 * - 100: Main entry - Personal name (Author)
 * - 245: Title statement
 * - 250: Edition statement
 * - 260: Publication info (Publisher, Place, Date)
 * - 300: Physical description (Pages/Collation)
 * - 520: Summary/Description
 * - 650: Subject - Topical
 * - 856: Electronic location (Cover image URL)
 *
 * @param data - MergedBookData object to export
 * @returns MARCXML string
 */
export function generateMARCXML(data: MergedBookData): string {
  const now = new Date();
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, "");

  // Extract year from date
  const year = data.date ? data.date.split("-")[0] : "    ";

  // Build 008 field (fixed-length data elements)
  // Format: Date entered, Publication date, Place, Language, etc.
  const field008 = `${timestamp}s${year}    xx            000 0 eng d`;

  // Escape XML special characters
  const escapeXML = (str: string | undefined | null): string => {
    if (!str || str === "-") return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  // Split author name for MARC format
  // MARC 100 expects: $a Personal name $d Dates
  const authorParts = data.author
    ? data.author.split(",").map((a: string) => a.trim())
    : [];
  const authorMain = authorParts[0] || "";

  // Build MARCXML structure
  let marcxml = `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.loc.gov/MARC21/slim http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd">
  <record>
    <leader>00000nam a2200000 a 4500</leader>
    <controlfield tag="001">${escapeXML(data.isbn13 || data.isbn10 || "UNKNOWN")}</controlfield>
    <controlfield tag="008">${field008}</controlfield>
`;

  // 020 - ISBN
  if (data.isbn13 || data.isbn10) {
    marcxml += `    <datafield tag="020" ind1=" " ind2=" ">
      <subfield code="a">${escapeXML(data.isbn13 || data.isbn10)}</subfield>
    </datafield>
`;
  }

  // 050 - Library of Congress Call Number
  if (data.lcc && data.lcc !== "-") {
    marcxml += `    <datafield tag="050" ind1="0" ind2="0">
      <subfield code="a">${escapeXML(data.lcc)}</subfield>
    </datafield>
`;
  }

  // 082 - Dewey Decimal Classification
  if (data.ddc && data.ddc !== "-") {
    marcxml += `    <datafield tag="082" ind1="0" ind2="0">
      <subfield code="a">${escapeXML(data.ddc)}</subfield>
    </datafield>
`;
  }

  // 090 - Local call number
  if (data.callNumber && data.callNumber !== "-") {
    marcxml += `    <datafield tag="090" ind1=" " ind2=" ">
      <subfield code="a">${escapeXML(data.callNumber)}</subfield>
    </datafield>
`;
  }

  // 100 - Main entry - Personal name (First author)
  if (authorMain) {
    marcxml += `    <datafield tag="100" ind1="1" ind2=" ">
      <subfield code="a">${escapeXML(authorMain)}.</subfield>
    </datafield>
`;
  }

  // 245 - Title statement
  const ind2 =
    data.title && /^(the|a|an) /i.test(data.title)
      ? data.title.toLowerCase().startsWith("the ")
        ? "4"
        : "2"
      : "0";

  marcxml += `    <datafield tag="245" ind1="1" ind2="${ind2}">
      <subfield code="a">${escapeXML(data.title)}</subfield>
`;

  if (authorMain) {
    marcxml += `      <subfield code="c">${escapeXML(data.author)}</subfield>
`;
  }

  marcxml += `    </datafield>
`;

  // 250 - Edition statement
  if (data.edition && data.edition !== "-") {
    marcxml += `    <datafield tag="250" ind1=" " ind2=" ">
      <subfield code="a">${escapeXML(data.edition)}</subfield>
    </datafield>
`;
  }

  // 260 - Publication, Distribution, etc.
  if (data.publisher || year) {
    marcxml += `    <datafield tag="260" ind1=" " ind2=" ">
`;
    if (data.publisher) {
      const pubParts = data.publisher.split(":").map((p) => p.trim());
      if (pubParts.length > 1) {
        marcxml += `      <subfield code="a">${escapeXML(pubParts[0])} :</subfield>
      <subfield code="b">${escapeXML(pubParts[1].replace(/,.*/, ""))},</subfield>
`;
      } else {
        marcxml += `      <subfield code="b">${escapeXML(data.publisher)},</subfield>
`;
      }
    }
    if (year) {
      marcxml += `      <subfield code="c">${escapeXML(year)}.</subfield>
`;
    }
    marcxml += `    </datafield>
`;
  }

  // 300 - Physical description (Collation)
  if (data.collation && data.collation !== "-") {
    marcxml += `    <datafield tag="300" ind1=" " ind2=" ">
      <subfield code="a">${escapeXML(data.collation)}</subfield>
    </datafield>
`;
  }

  // 520 - Summary, Abstract, Annotation, etc.
  if (data.description && data.description !== "-") {
    marcxml += `    <datafield tag="520" ind1=" " ind2=" ">
      <subfield code="a">${escapeXML(data.description)}</subfield>
    </datafield>
`;
  }

  // 650 - Subject - Topical (split multiple subjects)
  if (data.subjects && data.subjects !== "-") {
    const subjects = data.subjects
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s);
    subjects.forEach((subject) => {
      marcxml += `    <datafield tag="650" ind1=" " ind2="0">
      <subfield code="a">${escapeXML(subject)}.</subfield>
    </datafield>
`;
    });
  }

  // 856 - Electronic Location and Access (Cover image)
  if (data.cover && data.cover !== "/placeholder-book.png") {
    marcxml += `    <datafield tag="856" ind1="4" ind2="2">
      <subfield code="3">Cover image</subfield>
      <subfield code="u">${escapeXML(data.cover)}</subfield>
    </datafield>
`;
  }

  // Close record and collection
  marcxml += `  </record>
</collection>`;

  return marcxml;
}

/**
 * Trigger browser download of a file
 *
 * @param content - File content as string
 * @param filename - Name of the file to download
 * @param mimeType - MIME type of the file
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  // Create a Blob from the content
  const blob = new Blob([content], { type: mimeType });

  // Create a temporary download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export book data as SLiMS CSV and trigger download
 */
export function exportToSLiMSCSV(data: MergedBookData): void {
  const csv = generateSLiMSCSV(data);
  const filename = `slims_${data.isbn13 || data.isbn10 || "book"}_${Date.now()}.csv`;

  // Prepend UTF-8 BOM for Excel/SLiMS compatibility (Windows)
  const bomPrefixedCsv = "\uFEFF" + csv;
  const blob = new Blob([bomPrefixedCsv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export book data as MARCXML and trigger download
 */
export function exportToMARCXML(data: MergedBookData): void {
  const xml = generateMARCXML(data);
  const filename = `marc_${data.isbn13 || data.isbn10 || "book"}_${Date.now()}.xml`;
  downloadFile(xml, filename, "application/xml;charset=utf-8;");
}

/**
 * Generate batch CSV export for multiple books (SLiMS 9 Bulian format)
 *
 * 18-Column Schema (STRICT SLiMS compatibility):
 * 1. title - Main title of the book
 * 2. gmd_name - General Material Designation (e.g., "Text", "Art Paper")
 * 3. edition - Edition statement (e.g., "1st ed.", "Cet. 1")
 * 4. isbn_issn - Clean ISBN without dashes
 * 5. publisher_name - Publisher name only
 * 6. publish_year - 4-digit year
 * 7. collation - Physical description (e.g., "xx, 432 p. : ill. ; 24 cm")
 * 8. series_title - Series name
 * 9. call_number - Call number (e.g., "005.1 MAR c")
 * 10. language_name - Full language name (NOT ISO codes)
 * 11. place_name - City of publication
 * 12. classification - DDC Number
 * 13. notes - General notes/summary
 * 14. image - Cover image URL
 * 15. sor - Statement of Responsibility (author name)
 * 16. authors - Author names (separate with ; if multiple)
 * 17. topics - Subjects/Keywords (separate with ;)
 * 18. item_code - Barcode/inventory ID (optional)
 *
 * @param books - Array of MergedBookData objects to export
 * @returns CSV string with headers and data rows for all books
 */
export function generateBatchCSV(books: MergedBookData[]): string {
  // SLiMS 9 Bulian Standard Headers (18 columns)
  const headers = [
    "title",
    "gmd_name",
    "edition",
    "isbn_issn",
    "publisher_name",
    "publish_year",
    "collation",
    "series_title",
    "call_number",
    "language_name",
    "place_name",
    "classification",
    "notes",
    "image",
    "sor",
    "authors",
    "topics",
    "item_code",
  ];

  /**
   * Escape and quote CSV values (SLiMS Windows compatibility)
   * - ALL fields must be wrapped in double quotes
   * - Internal quotes are escaped by doubling them
   */
  const escapeCSV = (value: string | undefined | null): string => {
    if (!value || value === "-") return '""';

    // Convert to string and escape internal quotes
    const escaped = String(value).replace(/"/g, '""');

    // Always wrap in quotes for SLiMS compatibility
    return `"${escaped}"`;
  };

  /**
   * Clean ISBN: Remove dashes and spaces
   */
  const cleanISBN = (isbn: string | undefined | null): string => {
    if (!isbn || isbn === "-") return "";
    return isbn.replace(/[-\s]/g, "");
  };

  /**
   * Extract place name from publisherString
   * Format: "Place : Publisher, Year"
   */
  const extractPlace = (publisherString: string): string => {
    if (!publisherString || publisherString === "-") return "";
    const parts = publisherString.split(":");
    return parts.length > 1 ? parts[0].trim() : "";
  };

  /**
   * Extract publisher name from publisherString
   * Format: "Place : Publisher, Year"
   */
  const extractPublisher = (
    publisherString: string,
    fallbackPublisher: string,
  ): string => {
    if (!publisherString || publisherString === "-")
      return fallbackPublisher || "";
    const parts = publisherString.split(":");
    if (parts.length > 1) {
      // Extract "Publisher, Year" and remove year
      const publisherYear = parts[1].trim();
      return publisherYear.split(",")[0].trim();
    }
    return fallbackPublisher || "";
  };

  /**
   * Extract year from date field (YYYY-MM-DD or publisherString)
   */
  const extractYear = (date: string, publisherString: string): string => {
    if (date && date !== "-") {
      const year = date.split("-")[0];
      if (year.length === 4) return year;
    }

    // Fallback: extract from publisherString
    if (publisherString && publisherString !== "-") {
      const match = publisherString.match(/,\s*(\d{4})/);
      if (match) return match[1];
    }

    return "";
  };

  /**
   * Map language codes to full names (SLiMS requirement)
   */
  const mapLanguage = (lang: string): string => {
    if (!lang || lang === "-") return "English";

    const langLower = lang.toLowerCase();
    const langMap: Record<string, string> = {
      en: "English",
      english: "English",
      id: "Indonesia",
      indonesia: "Indonesia",
      indonesian: "Indonesia",
      ms: "Malay",
      malay: "Malay",
      fr: "French",
      french: "French",
      de: "German",
      german: "German",
      es: "Spanish",
      spanish: "Spanish",
      ar: "Arabic",
      arabic: "Arabic",
      zh: "Chinese",
      chinese: "Chinese",
      ja: "Japanese",
      japanese: "Japanese",
      ko: "Korean",
      korean: "Korean",
    };

    return langMap[langLower] || lang;
  };

  /**
   * Generate unique item code (barcode)
   * Format: RNG-YYYY-XXXXX (e.g., RNG-2025-00001)
   */
  const generateItemCode = (index: number): string => {
    const year = new Date().getFullYear();
    const sequence = String(index + 1).padStart(5, "0");
    return `RNG-${year}-${sequence}`;
  };

  // Generate rows
  const rows = books.map((book, index) => {
    const cleanedISBN = cleanISBN(book.isbn13 || book.isbn10);
    const place = extractPlace(book.publisherString);
    const publisher = extractPublisher(book.publisherString, book.publisher);
    const year = extractYear(book.date, book.publisherString);
    const language = mapLanguage(book.language);
    const coverUrl =
      book.cover && book.cover !== "/placeholder-book.png" ? book.cover : "";

    return [
      escapeCSV(book.title),
      escapeCSV(book.gmd || "Text"),
      escapeCSV(book.edition),
      escapeCSV(cleanedISBN),
      escapeCSV(publisher),
      escapeCSV(year),
      escapeCSV(book.collation),
      escapeCSV(book.series),
      escapeCSV(book.callNumber),
      escapeCSV(language),
      escapeCSV(place),
      escapeCSV(
        book.classification !== "NONE" ? book.classification : book.ddc,
      ),
      escapeCSV(book.description),
      escapeCSV(coverUrl),
      escapeCSV(book.author), // sor (Statement of Responsibility)
      escapeCSV(book.author), // authors
      escapeCSV(book.subjects), // topics
      escapeCSV(generateItemCode(index)), // item_code
    ].join(",");
  });

  // Combine header and rows
  return [headers.join(","), ...rows].join("\n");
}

/**
 * Export multiple books to SLiMS CSV and trigger download
 *
 * @param books - Array of MergedBookData objects to export
 */
export function exportBatchToSLiMSCSV(books: MergedBookData[]): void {
  if (books.length === 0) {
    throw new Error("No books to export");
  }

  const csvContent = generateBatchCSV(books);

  // Professional filename format: rangkai_batch_[YYYY-MM-DD]_[Count].csv
  const date = new Date().toISOString().split("T")[0];
  const count = books.length;
  const filename = `rangkai_batch_${date}_${count}.csv`;

  // Prepend UTF-8 BOM (\uFEFF) for Excel/SLiMS compatibility
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
