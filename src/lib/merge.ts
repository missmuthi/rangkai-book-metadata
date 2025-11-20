import type { GoogleBookItem, OpenLibraryBookData, MergedBookData } from './types';
import { generateCallNumber as generateCallNumberWithCutter, getCutterNumber, type CallNumberPattern } from './cutter';

// Enhanced language mapping with comprehensive ISO 639-1, 639-2, and 639-3 codes
export function mapLangCode(code: string): string {
  if (!code || code === '-') return '-';
  
  // Clean and normalize the code (handle locale variants like en-US)
  const normalized = code.toLowerCase().trim().split('-')[0]; // Take only the language part
  
  const langMap: Record<string, string> = {
    // English variants
    'en': 'English',
    'eng': 'English',
    
    // Indonesian variants
    'id': 'Bahasa Indonesia',
    'ind': 'Bahasa Indonesia',
    'in': 'Bahasa Indonesia',
    'indonesia': 'Bahasa Indonesia',
    
    // Common languages
    'es': 'Spanish',
    'spa': 'Spanish',
    'fr': 'French',
    'fre': 'French',
    'fra': 'French',
    'de': 'German',
    'ger': 'German',
    'deu': 'German',
    'ar': 'Arabic',
    'ara': 'Arabic',
    'zh': 'Chinese',
    'chi': 'Chinese',
    'zho': 'Chinese',
    'ja': 'Japanese',
    'jpn': 'Japanese',
    'ko': 'Korean',
    'kor': 'Korean',
    'pt': 'Portuguese',
    'por': 'Portuguese',
    'ru': 'Russian',
    'rus': 'Russian',
    'it': 'Italian',
    'ita': 'Italian',
    'nl': 'Dutch',
    'dut': 'Dutch',
    'nld': 'Dutch',
    'pl': 'Polish',
    'pol': 'Polish',
    'sv': 'Swedish',
    'swe': 'Swedish',
    'tr': 'Turkish',
    'tur': 'Turkish',
    'hi': 'Hindi',
    'hin': 'Hindi',
    'bn': 'Bengali',
    'ben': 'Bengali',
    'vi': 'Vietnamese',
    'vie': 'Vietnamese',
    'th': 'Thai',
    'tha': 'Thai',
    'ms': 'Malay',
    'may': 'Malay',
    'msa': 'Malay',
    'tl': 'Tagalog',
    'tgl': 'Tagalog',
    'jv': 'Javanese',
    'jav': 'Javanese',
    'su': 'Sundanese',
    'sun': 'Sundanese'
  };
  
  return langMap[normalized] || code.toUpperCase(); // Return uppercase code if not found
}

// Clean and format author names to "Lastname, Firstname" format
export function formatAuthorName(rawName: string): string {
  if (!rawName || rawName === '-') return '-';
  
  // Remove prefixes like "By ", "by ", "Oleh ", "oleh "
  let cleanName = rawName.trim();
  cleanName = cleanName.replace(/^(by|By|BY|oleh|Oleh|OLEH)\s+/i, '');
  
  // Remove trailing non-period punctuation (commas, etc.) but keep periods for now
  cleanName = cleanName.replace(/[,;:!?]+$/, '').trim();
  
  // If already in "Last, First" format, return as-is
  if (cleanName.includes(',')) {
    return cleanName;
  }
  
  // Split into parts
  const parts = cleanName.split(/\s+/);
  
  // Handle single name (e.g., "Madonna", "Plato")
  if (parts.length === 1) {
    // Remove trailing period from single names
    cleanName = cleanName.replace(/\.$/, '').trim();
    return cleanName;
  }
  
  // Handle "Jr.", "Sr.", "III", etc. - check BEFORE removing trailing punctuation
  const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'phd', 'ph.d', 'md', 'm.d'];
  const lastPart = parts[parts.length - 1].toLowerCase().replace(/\./g, '');
  
  if (suffixes.includes(lastPart)) {
    // e.g., "Martin Luther King Jr." -> "King, Martin Luther, Jr."
    const suffix = parts.pop();
    const lastName = parts.pop();
    const firstName = parts.join(' ');
    return `${lastName}, ${firstName}, ${suffix}`;
  }
  
  // For regular names, remove trailing period from the last word if it's not an abbreviation
  const lastWord = parts[parts.length - 1];
  const isAbbreviation = /^[A-Z]\.$/.test(lastWord) || /^[A-Z]\.[A-Z]\.$/.test(lastWord);
  
  if (!isAbbreviation && lastWord.endsWith('.')) {
    // It's just a regular word with a trailing period, remove it
    cleanName = cleanName.replace(/\.$/, '').trim();
    // Re-split after cleaning
    const updatedParts = cleanName.split(/\s+/);
    const updatedLastName = updatedParts.pop();
    const updatedFirstName = updatedParts.join(' ');
    return `${updatedLastName}, ${updatedFirstName}`;
  }
  
  // Standard format: "First Middle Last" -> "Last, First Middle"
  const lastName = parts.pop();
  const firstName = parts.join(' ');
  
  return `${lastName}, ${firstName}`;
}

// Format edition strings properly
export function formatEdition(edition: string | undefined | null): string {
  if (!edition) return ''; // Return empty string instead of '-'
  
  // Clean the edition string
  let cleanEdition = edition.trim();
  
  // If it's already formatted nicely, return it
  if (cleanEdition.match(/^\d+(st|nd|rd|th)\s+(ed\.|edition)/i)) {
    return cleanEdition;
  }
  
  // If it's "Cet. 1" or similar Indonesian format, keep it
  if (cleanEdition.match(/^cet\.\s*\d+/i)) {
    return cleanEdition;
  }
  
  // Try to extract edition number
  const numberMatch = cleanEdition.match(/(\d+)/);
  if (numberMatch) {
    const num = parseInt(numberMatch[1]);
    // Proper ordinal suffix logic
    const lastDigit = num % 10;
    const lastTwoDigits = num % 100;
    let suffix: string;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      suffix = 'th';
    } else if (lastDigit === 1) {
      suffix = 'st';
    } else if (lastDigit === 2) {
      suffix = 'nd';
    } else if (lastDigit === 3) {
      suffix = 'rd';
    } else {
      suffix = 'th';
    }
    
    return `${num}${suffix} ed.`;
  }
  
  // If we can't parse it, return empty for unparseable strings
  // (unless it looks intentional like "Revised edition")
  return cleanEdition.match(/edition|ed\.|cet\./i) ? cleanEdition : '';
}

export function mapSubjectToDDC(subjects: string): string {
  if (!subjects || subjects === '-') return '-';
  const s = subjects.toLowerCase();
  if (s.includes('english language') || s.includes('grammar')) return '425';
  if (s.includes('language')) return '400';
  if (s.includes('fiction') || s.includes('literature')) return '800';
  if (s.includes('poetry')) return '801';
  if (s.includes('religion') || s.includes('christianity')) return '200';
  if (s.includes('islam')) return '297';
  if (s.includes('social sci')) return '300';
  if (s.includes('economics')) return '330';
  if (s.includes('education')) return '370';
  if (s.includes('science')) return '500';
  if (s.includes('mathematics') || s.includes('math')) return '510';
  if (s.includes('physics')) return '530';
  if (s.includes('chemistry')) return '540';
  if (s.includes('biology')) return '570';
  if (s.includes('technology')) return '600';
  if (s.includes('medicine')) return '610';
  if (s.includes('engineering')) return '620';
  if (s.includes('art') || s.includes('arts')) return '700';
  if (s.includes('music')) return '780';
  if (s.includes('history')) return '900';
  if (s.includes('geography')) return '910';
  if (s.includes('computer') || s.includes('computing')) return '004';
  return '-';
}

/**
 * Generate call number using Cutter-Sanborn tables
 * Supports multiple patterns configurable by the user
 * 
 * @param ddc - Dewey Decimal Classification
 * @param lcc - Library of Congress Classification
 * @param subjects - Subject headings (for fallback DDC mapping)
 * @param author - Author name
 * @param title - Book title
 * @param publisher - Publisher name (fallback if no author)
 * @param year - Publication year
 * @param pattern - Call number pattern (default: 'ddc-cutter-title')
 * @returns Formatted call number using Cutter-Sanborn system
 */
function generateCallNumber(
  ddc: string, 
  lcc: string, 
  subjects: string, 
  author: string, 
  title: string, 
  publisher: string, 
  year: string,
  pattern: CallNumberPattern = 'ddc-cutter-title'
) {
  // Determine classification number (DDC preferred, then LCC, then subject-based)
  let classification: string = ddc;
  if (!classification || classification === '-') classification = lcc;
  if (!classification || classification === '-') classification = mapSubjectToDDC(subjects);
  if (!classification || classification === '-') return '-';

  // Determine author name for Cutter number (fallback to publisher if no author)
  let authorForCutter = author;
  if (!authorForCutter || authorForCutter === '-') {
    authorForCutter = publisher;
  }
  
  if (!authorForCutter || authorForCutter === '-') {
    // No author or publisher - just return classification
    return classification;
  }

  // Use the Cutter-Sanborn system to generate the call number
  return generateCallNumberWithCutter(
    pattern,
    classification,
    authorForCutter,
    title,
    year
  );
}

export function processAndRenderMergedData(
  google: GoogleBookItem['volumeInfo'] | null,
  openlib: OpenLibraryBookData | null
): MergedBookData {
  const merged: MergedBookData = {
    title: '-',
    author: '-',
    publisher: '-',
    date: '-',
    pages: '-',
    isbn13: '-',
    isbn10: '-',
    ddc: '-',
    lcc: '-',
    callNumber: '-',
    description: '-',
    language: '-',
    subjects: '-',
    series: '-',
    publisherString: '-',
    collation: '-',
    classification: '-',
    edition: '-',
    specificDetail: '-',
    gmd: '-',
    infoLink: '-',
    cover: '',
    isPartialData: false,
    dataSource: 'both'
  };

  merged.title = openlib?.title || google?.title || '-';
  
  // Format author name properly (Lastname, Firstname)
  const rawAuthor = openlib?.authors?.[0]?.name || google?.authors?.[0] || '-';
  merged.author = formatAuthorName(rawAuthor);
  
  merged.publisher = google?.publisher || openlib?.publishers?.[0]?.name || '-';
  merged.date = google?.publishedDate || (openlib?.publish_date ? openlib.publish_date.toString() : '-');
  merged.pages = google?.pageCount ? google.pageCount.toString() : (openlib?.number_of_pages ? openlib.number_of_pages.toString() : '-');

  const googleISBN13 = google?.industryIdentifiers?.find((id: { type?: string; identifier?: string } | any) => id?.type === 'ISBN_13')?.identifier;
  merged.isbn13 = googleISBN13 || openlib?.identifiers?.isbn_13?.[0] || '-';
  const googleISBN10 = google?.industryIdentifiers?.find((id: { type?: string; identifier?: string } | any) => id?.type === 'ISBN_10')?.identifier;
  merged.isbn10 = googleISBN10 || openlib?.identifiers?.isbn_10?.[0] || '-';

  merged.ddc = openlib?.classifications?.dewey_decimal_class?.[0] || '-';
  merged.lcc = openlib?.classifications?.lc_classifications?.[0] || '-';

  const openlibDescription = typeof openlib?.description === 'object' ? openlib.description?.value : openlib?.description;
  merged.description = google?.description || openlibDescription || '-';

  const googleLang = google?.language;
  const openlibLangKey = openlib?.languages?.[0]?.key;
  const openlibLang = openlibLangKey ? openlibLangKey.split('/').pop() : null;
  merged.language = mapLangCode(googleLang || (openlibLang as string) || '-');

  const googleSubjects = google?.categories?.join(', ');
  const openlibSubjects = openlib?.subjects?.slice(0, 5).join(', ');
  merged.subjects = googleSubjects || openlibSubjects || '-';

  if (google?.printType === 'BOOK') merged.gmd = 'Text';
  else if (google?.printType) merged.gmd = google.printType;

  merged.infoLink = google?.infoLink || '-';
  merged.cover = (google as any)?.imageLinks?.thumbnail || openlib?.cover?.large || '';

  const pubYear = merged.date && typeof merged.date === 'string' ? merged.date.substring(0, 4) : '-';
  merged.callNumber = generateCallNumber(merged.ddc, merged.lcc, merged.subjects, merged.author, merged.title, merged.publisher, pubYear);
  merged.series = openlib?.series?.[0] || '-';
  
  // Format edition properly (empty if not available, formatted if available)
  const rawEdition = openlib?.edition_name || google?.subtitle?.match(/(\d+(st|nd|rd|th)\s+edition)/i)?.[0];
  merged.edition = formatEdition(rawEdition);
  
  merged.collation = merged.pages && merged.pages !== '-' ? `${merged.pages} p.` : '-';
  merged.specificDetail = merged.publisher;

  const pubPlace = openlib?.publish_places?.[0] || '-';
  if (pubPlace === '-' && merged.publisher === '-' && pubYear === '-') merged.publisherString = '-';
  else merged.publisherString = `${pubPlace} : ${merged.publisher}, ${pubYear}`;

  merged.classification = merged.ddc !== '-' ? merged.ddc : merged.lcc !== '-' ? merged.lcc : mapSubjectToDDC(merged.subjects) || 'NONE';
  if (merged.classification === '-') merged.classification = 'NONE';

  return merged;
}

export { getCutterNumber, type CallNumberPattern };
