/**
 * Export utilities for SLiMS CSV and MARCXML formats
 * Transforms MergedBookData into standard library catalog formats
 */

import type { MergedBookData } from './types';

/**
 * Generate SLiMS-compatible CSV export
 * 
 * SLiMS Column Order (typical):
 * Title, Author, ISBN, Publisher, Publish Year, Call Number, Edition, 
 * Collation (Pages), Language, Subject/Topic, GMD, Notes, Cover Image URL
 * 
 * @param data - MergedBookData object to export
 * @returns CSV string with headers and data row
 */
export function generateSLiMSCSV(data: MergedBookData): string {
  // CSV Headers (based on SLiMS import template)
  const headers = [
    'Title',
    'Author(s)',
    'ISBN/ISSN',
    'Publisher',
    'Publish Year',
    'Call Number',
    'Edition',
    'Collation',
    'Language',
    'Subject/Topic',
    'GMD',
    'Notes',
    'Cover Image URL'
  ];

  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCSV = (value: string | undefined | null): string => {
    if (!value || value === '-') return '';
    
    // Convert to string and handle special characters
    let escaped = String(value);
    
    // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
      escaped = '"' + escaped.replace(/"/g, '""') + '"';
    }
    
    return escaped;
  };

  // Build data row
  const coverUrl = data.cover !== '/placeholder-book.png' ? data.cover : '';
  
  const row = [
    escapeCSV(data.title),
    escapeCSV(data.author),
    escapeCSV(data.isbn13 || data.isbn10), // Prefer ISBN-13
    escapeCSV(data.publisher),
    escapeCSV(data.date?.split('-')[0]), // Extract year only
    escapeCSV(data.callNumber),
    escapeCSV(data.edition),
    escapeCSV(data.collation),
    escapeCSV(data.language),
    escapeCSV(data.subjects),
    escapeCSV(data.gmd),
    escapeCSV(data.description),
    escapeCSV(coverUrl)
  ];

  // Combine headers and row
  return headers.join(',') + '\n' + row.join(',');
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
  const timestamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Extract year from date
  const year = data.date ? data.date.split('-')[0] : '    ';
  
  // Build 008 field (fixed-length data elements)
  // Format: Date entered, Publication date, Place, Language, etc.
  const field008 = `${timestamp}s${year}    xx            000 0 eng d`;
  
  // Escape XML special characters
  const escapeXML = (str: string | undefined | null): string => {
    if (!str || str === '-') return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Split author name for MARC format
  // MARC 100 expects: $a Personal name $d Dates
  const authorParts = data.author ? data.author.split(',').map((a: string) => a.trim()) : [];
  const authorMain = authorParts[0] || '';
  
  // Build MARCXML structure
  let marcxml = `<?xml version="1.0" encoding="UTF-8"?>
<collection xmlns="http://www.loc.gov/MARC21/slim" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.loc.gov/MARC21/slim http://www.loc.gov/standards/marcxml/schema/MARC21slim.xsd">
  <record>
    <leader>00000nam a2200000 a 4500</leader>
    <controlfield tag="001">${escapeXML(data.isbn13 || data.isbn10 || 'UNKNOWN')}</controlfield>
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
  if (data.lcc && data.lcc !== '-') {
    marcxml += `    <datafield tag="050" ind1="0" ind2="0">
      <subfield code="a">${escapeXML(data.lcc)}</subfield>
    </datafield>
`;
  }

  // 082 - Dewey Decimal Classification
  if (data.ddc && data.ddc !== '-') {
    marcxml += `    <datafield tag="082" ind1="0" ind2="0">
      <subfield code="a">${escapeXML(data.ddc)}</subfield>
    </datafield>
`;
  }

  // 090 - Local call number
  if (data.callNumber && data.callNumber !== '-') {
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
  const ind2 = data.title && /^(the|a|an) /i.test(data.title) ? 
    (data.title.toLowerCase().startsWith('the ') ? '4' : '2') : '0';
  
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
  if (data.edition && data.edition !== '-') {
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
      const pubParts = data.publisher.split(':').map(p => p.trim());
      if (pubParts.length > 1) {
        marcxml += `      <subfield code="a">${escapeXML(pubParts[0])} :</subfield>
      <subfield code="b">${escapeXML(pubParts[1].replace(/,.*/, ''))},</subfield>
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
  if (data.collation && data.collation !== '-') {
    marcxml += `    <datafield tag="300" ind1=" " ind2=" ">
      <subfield code="a">${escapeXML(data.collation)}</subfield>
    </datafield>
`;
  }

  // 520 - Summary, Abstract, Annotation, etc.
  if (data.description && data.description !== '-') {
    marcxml += `    <datafield tag="520" ind1=" " ind2=" ">
      <subfield code="a">${escapeXML(data.description)}</subfield>
    </datafield>
`;
  }

  // 650 - Subject - Topical (split multiple subjects)
  if (data.subjects && data.subjects !== '-') {
    const subjects = data.subjects.split(';').map(s => s.trim()).filter(s => s);
    subjects.forEach(subject => {
      marcxml += `    <datafield tag="650" ind1=" " ind2="0">
      <subfield code="a">${escapeXML(subject)}.</subfield>
    </datafield>
`;
    });
  }

  // 856 - Electronic Location and Access (Cover image)
  if (data.cover && data.cover !== '/placeholder-book.png') {
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
export function downloadFile(content: string, filename: string, mimeType: string): void {
  // Create a Blob from the content
  const blob = new Blob([content], { type: mimeType });
  
  // Create a temporary download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
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
  const filename = `slims_${data.isbn13 || data.isbn10 || 'book'}_${Date.now()}.csv`;
  downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Export book data as MARCXML and trigger download
 */
export function exportToMARCXML(data: MergedBookData): void {
  const xml = generateMARCXML(data);
  const filename = `marc_${data.isbn13 || data.isbn10 || 'book'}_${Date.now()}.xml`;
  downloadFile(xml, filename, 'application/xml;charset=utf-8;');
}

/**
 * Generate batch CSV export for multiple books (SLiMS format)
 * 
 * @param books - Array of MergedBookData objects to export
 * @returns CSV string with headers and data rows for all books
 */
export function generateBatchCSV(books: MergedBookData[]): string {
  const headers = [
    'Title',
    'GMD',
    'Series Title',
    'Call Number',
    'Publisher',
    'Collation',
    'Language',
    'ISBN/ISSN',
    'Classification',
    'Subject(s)',
    'Specific Detail Info',
    'Statement of Responsibility',
    'Edition'
  ];

  // Escape CSV value
  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Generate rows
  const rows = books.map(book => {
    return [
      escapeCSV(book.title),
      escapeCSV(book.gmd),
      escapeCSV(book.series),
      escapeCSV(book.callNumber),
      escapeCSV(book.publisherString),
      escapeCSV(book.collation),
      escapeCSV(book.language),
      escapeCSV(book.isbn13),
      escapeCSV(book.classification),
      escapeCSV(book.subjects),
      escapeCSV(book.specificDetail),
      escapeCSV(book.author),
      escapeCSV(book.edition)
    ].join(',');
  });

  // Combine header and rows
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Export multiple books to SLiMS CSV and trigger download
 * 
 * @param books - Array of MergedBookData objects to export
 */
export function exportBatchToSLiMSCSV(books: MergedBookData[]): void {
  if (books.length === 0) {
    throw new Error('No books to export');
  }

  const csvContent = generateBatchCSV(books);
  const filename = `rangkai-batch-export-${new Date().toISOString().split('T')[0]}.csv`;
  
  // Prepend UTF-8 BOM for Excel/SLiMS compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
