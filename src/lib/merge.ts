import type { GoogleBookItem, OpenLibraryBookData, MergedBookData } from './types';

const placeholderImg = 'https://placehold.co/300x450/e0e0e0/7c7c7c?text=No+Cover';

export function mapLangCode(code: string) {
  if (!code || code === '-') return '-';
  const langMap: { [key: string]: string } = {
    en: 'English',
    eng: 'English',
    id: 'Indonesian',
    ind: 'Indonesian',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    ar: 'Arabic'
  };
  return langMap[code.toLowerCase()] || code;
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

function generateCallNumber(ddc: string, lcc: string, subjects: string, author: string, title: string, publisher: string, year: string) {
  let classification: string = ddc;
  if (!classification || classification === '-') classification = lcc;
  if (!classification || classification === '-') classification = mapSubjectToDDC(subjects);
  if (!classification || classification === '-') return '-';

  let abbr = '???';
  if (author && author !== '-') {
    const nameParts = author.split(' ');
    const lastName = nameParts[nameParts.length - 1];
    abbr = lastName.substring(0, 3).toUpperCase();
  } else if (publisher && publisher !== '-') {
    const publisherParts = publisher.split(' ');
    const firstWord = publisherParts[0].replace(/,/g, '');
    abbr = firstWord.substring(0, 3).toUpperCase();
  }

  let titleLetter = '?';
  if (title && title !== '-') {
    let cleanTitle = title.replace(/^(the |a |an |sebuah |seorang )/i, '');
    if (cleanTitle.length === 0) cleanTitle = title;
    titleLetter = cleanTitle.substring(0, 1).toLowerCase();
  }

  const base = `${classification} ${abbr} ${titleLetter}`;
  if (year && year !== '-') {
    return `${base} ${year}`;
  } else {
    return base;
  }
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
    cover: placeholderImg
  };

  merged.title = openlib?.title || google?.title || '-';
  merged.author = openlib?.authors?.[0]?.name || google?.authors?.[0] || '-';
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
  merged.cover = (google as any)?.imageLinks?.thumbnail || openlib?.cover?.large || placeholderImg;

  const pubYear = merged.date && typeof merged.date === 'string' ? merged.date.substring(0, 4) : '-';
  merged.callNumber = generateCallNumber(merged.ddc, merged.lcc, merged.subjects, merged.author, merged.title, merged.publisher, pubYear);
  merged.series = openlib?.series?.[0] || '-';
  merged.edition = openlib?.edition_name || '-';
  merged.collation = merged.pages && merged.pages !== '-' ? `${merged.pages} p.` : '-';
  merged.specificDetail = merged.publisher;

  const pubPlace = openlib?.publish_places?.[0] || '-';
  if (pubPlace === '-' && merged.publisher === '-' && pubYear === '-') merged.publisherString = '-';
  else merged.publisherString = `${pubPlace} : ${merged.publisher}, ${pubYear}`;

  merged.classification = merged.ddc !== '-' ? merged.ddc : merged.lcc !== '-' ? merged.lcc : mapSubjectToDDC(merged.subjects) || 'NONE';
  if (merged.classification === '-') merged.classification = 'NONE';

  return merged;
}

export { placeholderImg };
