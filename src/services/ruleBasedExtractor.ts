import { Clause } from "@/types/clause";

export interface NumberingSchema {
  mainClause: string;
  subClause1: string;
  subClause2: string;
  subClause3?: string;
}

/**
 * Normalize text by removing extra spaces
 * PDF extraction often introduces extra spacing between words
 * This function collapses multiple spaces into single spaces
 */
function normalizeText(text: string): string {
  if (!text) return text;
  // Convert ALL whitespace characters to regular space first
  let result = text
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      // Replace any whitespace-like character (space, tab, various unicode spaces) except newline/carriage return
      if ((code >= 0x0009 && code <= 0x000D && code !== 0x000A && code !== 0x000D) || // tabs, form feed, etc
          code === 0x0020 || // regular space
          code === 0x00A0 || // non-breaking space
          code === 0x1680 || // ogham space
          (code >= 0x2000 && code <= 0x200A) || // various typographic spaces
          code === 0x202F || // narrow no-break space
          code === 0x205F || // medium mathematical space
          code === 0x3000 || // ideographic space
          code === 0xFEFF) { // zero-width no-break space
        return ' ';
      }
      return char;
    })
    .join('');
  // Now collapse multiple spaces into single space
  result = result.replace(/ +/g, ' ');
  // Trim each line
  result = result.split('\n').map(line => line.trim()).join('\n');
  return result.trim();
}

/**
 * Remove stray page numbers from document text
 * Page numbers typically appear as standalone numbers on their own line
 * without periods, parentheses, or other clause formatting
 */
function removePageNumbers(text: string): string {
  // Pattern 1: Standalone numbers on their own line (e.g., "\n 1 \n" or "\n 15 \n")
  // These are page numbers that don't have periods or parentheses
  let cleaned = text.replace(/\n\s*(\d{1,4})\s*\n(?!\s*\d+\.)/g, '\n\n');

  // Pattern 2: Numbers at the very end of a line that look like page numbers
  // (isolated number after period/end of sentence, followed by newline)
  cleaned = cleaned.replace(/\.\s*\n\s*(\d{1,4})\s*\n/g, '.\n\n');

  // Pattern 3: Numbers at the start of document sections that are page numbers
  // (number followed by blank line and then "THIS" or other document start)
  cleaned = cleaned.replace(/\n\s*(\d{1,4})\s*\n\s*\n\s*(THIS|WHEREAS|BETWEEN|PARTIES)/gi, '\n\n$2');

  // Pattern 4: "Page X" or "Page X of Y" patterns
  cleaned = cleaned.replace(/\n\s*Page\s+\d+(\s+of\s+\d+)?\s*\n/gi, '\n\n');

  // Pattern 5: Numbers in brackets or parentheses that look like page refs (e.g., "[1]", "(1)")
  // but only when they appear alone on a line
  cleaned = cleaned.replace(/\n\s*[\[\(]\d{1,4}[\]\)]\s*\n/g, '\n\n');

  // Pattern 6: "- X -" style page numbers (e.g., "- 1 -", "- 15 -")
  cleaned = cleaned.replace(/\n\s*-\s*\d{1,4}\s*-\s*\n/g, '\n\n');

  // Pattern 7: Exhibit/header references followed by page numbers at start
  // (e.g., "Exhibit 10.8\n\nServices Agreement\n\n....\n\n1\n\nTHIS SERVICES AGREEMENT")
  cleaned = cleaned.replace(/\n\s*(\d{1,4})\s*\n(?=\s*[A-Z]{2,})/g, '\n\n');

  // Clean up multiple consecutive newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned;
}

// Convert schema type to regex pattern
function getSchemaRegex(schemaType: string): RegExp | null {
  const patterns: Record<string, RegExp> = {
    "numeric": /^(\d+)\.\s+/,
    "numeric-paren": /^(\d+)\)\s+/,
    "decimal": /^(\d+\.\d+)\s+/,  // Matches 1.1, 1.2, 2.1, etc.
    "alpha-upper": /^([A-Z])\.\s+/,
    "alpha-lower": /^([a-z])\.\s+/,
    "alpha-lower-paren": /^([a-z])\)\s+/,
    "roman-upper": /^(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\.\s+/,
    "roman-lower": /^(i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx[ivx]*)\.\s+/,
    "roman-upper-paren": /^(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\)\s+/,
    "roman-lower-paren": /^(i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx[ivx]*)\)\s+/,
    "paren-numeric": /^\((\d+)\)\s+/,
    "paren-alpha": /^\(([a-z])\)\s+/,
    "paren-roman-upper": /^\((I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\)\s+/,
    "paren-roman-lower": /^\((i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx[ivx]*)\)\s+/,
    "section": /^Section\s+(\d+)\./i,  // Section 1., Section 2. (requires period after number)
    "section-decimal": /^Section\s+(\d+)\.(?!\d)/i,  // Section 1. (NOT Section 1.1 or Section 1(a))
    "article": /^(?:Article|ARTICLE)\s+([IVX]+|\d+)/i,
    "decimal-zero": /^(\d+)\.0\s+/,  // 1.0, 2.0, 3.0 (main clauses with .0)
    "decimal-triple": /^(\d+\.\d+\.\d+)\s+/,  // 1.1.1, 1.2.1, 2.1.1 (triple decimal)
  };
  return patterns[schemaType] || null;
}

// Convert schema type to split regex (for splitting document into main sections)
// These patterns work with or without newlines - they use lookahead to split before clause markers
function getSchemaSplitRegex(schemaType: string): RegExp | null {
  const patterns: Record<string, RegExp> = {
    "numeric": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\d+\.\s+[A-Z])/g,
    "numeric-paren": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\d+\)\s+[A-Z])/g,
    "decimal": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\d+\.\d+\s+[A-Z])/g,
    "alpha-upper": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=[A-Z]\.\s+[A-Z])/g,
    "alpha-lower": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=[a-z]\.\s+[A-Z])/g,
    "alpha-lower-paren": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=[a-z]\)\s+[A-Z])/g,
    "roman-upper": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\.\s+[A-Z])/g,
    "roman-lower": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=(i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx[ivx]*)\.\s+)/g,
    "roman-upper-paren": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\)\s+[A-Z])/g,
    "roman-lower-paren": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=(i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx[ivx]*)\)\s+)/g,
    "paren-numeric": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\(\d+\)\s+)/g,
    "paren-alpha": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\([a-z]\)\s+)/g,
    "paren-roman-upper": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\((I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\)\s+)/g,
    "paren-roman-lower": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\((i{1,3}|iv|vi{0,3}|ix|xi{0,3}|xiv|xv|xvi{0,3}|xix|xx[ivx]*)\)\s+)/g,
    "section": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3})|(?<=\s{2,}))(?=Section\s+\d+\.)/gi,  // Only match "Section X." with period
    "section-decimal": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3})|(?<=\s{2,}))(?=Section\s+\d+\.(?!\d))/gi,  // Section X. but not Section X.Y
    "article": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=(?:Article|ARTICLE)\s+(?:[IVX]+|\d+))/g,
    "decimal-zero": /(?:\n\s*|(?<=\.\s{1,3})|(?<=;\s{1,3}))(?=\d+\.0\s+[A-Z])/g,  // 1.0, 2.0, 3.0 main clauses
  };
  return patterns[schemaType] || null;
}

interface ExtractedClause {
  clause_type: string;
  clause_text: string;
  clause_no: string;  // The clause number/title (e.g., "8. Services for Others")
  preferred_position: string;
  party_role: string;
  complexity: number;
  balance: number;
  matched_from_repository?: boolean;
  similarity_score?: number;
}

interface RepositoryMatch {
  clauseType: string;
  score: number;
  matchedClauseId: string;
}

/**
 * Calculate text similarity using Jaccard similarity on word n-grams
 * Returns a score between 0 and 1
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) =>
    text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate n-gram similarity for better phrase matching
 */
function calculateNGramSimilarity(text1: string, text2: string, n: number = 3): number {
  const getNGrams = (text: string) => {
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter(w => w.length > 0);
    const ngrams = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  };

  const ngrams1 = getNGrams(text1);
  const ngrams2 = getNGrams(text2);

  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

  const intersection = new Set([...ngrams1].filter(ng => ngrams2.has(ng)));
  const union = new Set([...ngrams1, ...ngrams2]);

  return intersection.size / union.size;
}

/**
 * Find the best matching clause type from the repository based on text similarity
 */
export function matchClauseFromRepository(
  clauseText: string,
  repositoryClauses: Clause[],
  threshold: number = 0.15
): RepositoryMatch | null {
  if (!repositoryClauses || repositoryClauses.length === 0) {
    return null;
  }

  let bestMatch: RepositoryMatch | null = null;

  for (const repoClause of repositoryClauses) {
    // Skip repository clauses that are too short or generic
    if (!repoClause.clause_text || repoClause.clause_text.length < 50) continue;
    if (repoClause.clause_type === 'General Clause' || repoClause.clause_type === 'Other') continue;

    // Combined similarity: word overlap + n-gram matching
    const wordSimilarity = calculateTextSimilarity(clauseText, repoClause.clause_text);
    const ngramSimilarity = calculateNGramSimilarity(clauseText, repoClause.clause_text, 3);

    // Weight n-gram similarity higher for better phrase matching
    const combinedScore = (wordSimilarity * 0.4) + (ngramSimilarity * 0.6);

    if (combinedScore >= threshold && (!bestMatch || combinedScore > bestMatch.score)) {
      bestMatch = {
        clauseType: repoClause.clause_type,
        score: combinedScore,
        matchedClauseId: repoClause.id
      };
    }
  }

  return bestMatch;
}

/**
 * Group repository clauses by type for faster lookup
 */
function groupClausesByType(clauses: Clause[]): Map<string, Clause[]> {
  const grouped = new Map<string, Clause[]>();
  for (const clause of clauses) {
    const existing = grouped.get(clause.clause_type) || [];
    existing.push(clause);
    grouped.set(clause.clause_type, existing);
  }
  return grouped;
}

/**
 * Find best matching clause type by comparing against all clauses of each type
 */
export function findBestClauseTypeMatch(
  clauseText: string,
  repositoryClauses: Clause[],
  threshold: number = 0.12
): RepositoryMatch | null {
  const grouped = groupClausesByType(repositoryClauses);
  let bestMatch: RepositoryMatch | null = null;

  for (const [clauseType, clauses] of grouped) {
    if (clauseType === 'General Clause' || clauseType === 'Other') continue;

    // Find max similarity across all clauses of this type
    let maxScore = 0;
    let bestClauseId = '';

    for (const repoClause of clauses) {
      if (!repoClause.clause_text || repoClause.clause_text.length < 30) continue;

      const wordSim = calculateTextSimilarity(clauseText, repoClause.clause_text);
      const ngramSim = calculateNGramSimilarity(clauseText, repoClause.clause_text, 2);
      const score = (wordSim * 0.35) + (ngramSim * 0.65);

      if (score > maxScore) {
        maxScore = score;
        bestClauseId = repoClause.id;
      }
    }

    if (maxScore >= threshold && (!bestMatch || maxScore > bestMatch.score)) {
      bestMatch = {
        clauseType,
        score: maxScore,
        matchedClauseId: bestClauseId
      };
    }
  }

  return bestMatch;
}

const commonClauseTypes = [
  "Document Name",
  "Parties",
  "Agreement Date",
  "Effective Date",
  "Expiration Date",
  "Renewal Term",
  "Notice Period",
  "Governing Law",
  "Most Favored Nation",
  "Competitive Restriction",
  "Non-Compete",
  "Exclusivity",
  "No-Solicit",
  "Non-Disparagement",
  "Termination",
  "Rofr/Rofo/Rofn",
  "Change of Control",
  "Anti-Assignment",
  "Revenue/Profit Sharing",
  "Price Restrictions",
  "Minimum Commitment",
  "Volume Restriction",
  "Ip Ownership",
  "License Grant",
  "Source Code Escrow",
  "Post-Termination Services",
  "Audit Rights",
  "Liability Cap",
  "Liquidated Damages",
  "Warranty Duration",
  "Insurance",
  "Covenant Not To Sue",
  "Third Party Beneficiary",
  "Indemnification",
  "Confidentiality",
  "Force Majeure",
  "Payment Terms",
  "Dispute Resolution",
  "Severability",
  "Amendment",
  "Modification",
  "Waiver",
  "Entire Agreement",
  "Counterparts",
];

/**
 * Check if a clause number/title indicates a miscellaneous or general section
 */
function isMiscellaneousOrGeneralSection(clauseNo: string): boolean {
  const lower = clauseNo.toLowerCase();
  return lower.includes('miscellaneous') || lower.includes('general');
}

/**
 * Detect specific clause type for subclauses within miscellaneous/general sections
 */
function detectMiscellaneousSubclauseType(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Governing Law detection: "governing law" OR ("state" + "laws")
  if (lowerText.includes('governing law') ||
      (lowerText.includes('state') && lowerText.includes('laws')) ||
      (lowerText.includes('construed') && lowerText.includes('laws')) ||
      lowerText.includes('governed by the laws')) {
    return 'Governing Law';
  }

  // Counterparts detection
  if (lowerText.includes('counterpart')) {
    return 'Counterparts';
  }

  // Modification/Amendment detection
  if (lowerText.includes('amended') || lowerText.includes('modified') ||
      lowerText.includes('amendment') || lowerText.includes('modification')) {
    return 'Modification';
  }

  // Entire Agreement detection
  if (lowerText.includes('entire agreement') ||
      lowerText.includes('entire understanding') ||
      (lowerText.includes('constitutes the entire') && lowerText.includes('agreement'))) {
    return 'Entire Agreement';
  }

  // Severability detection
  if (lowerText.includes('severability') || lowerText.includes('severable') ||
      (lowerText.includes('invalid') && lowerText.includes('provision')) ||
      (lowerText.includes('unenforceable') && lowerText.includes('provision'))) {
    return 'Severability';
  }

  // Waiver detection
  if (lowerText.includes('waiver') || lowerText.includes('waive')) {
    return 'Waiver';
  }

  // Notice detection
  if (lowerText.includes('notice') && (lowerText.includes('shall be') || lowerText.includes('given'))) {
    return 'Notice Period';
  }

  // Assignment detection
  if (lowerText.includes('assignment') || lowerText.includes('assign')) {
    return 'Anti-Assignment';
  }

  // Successors and Assigns
  if (lowerText.includes('successors') && lowerText.includes('assigns')) {
    return 'Anti-Assignment';
  }

  return null;
}

/**
 * Extract subclauses from a miscellaneous/general section
 * Returns an array of extracted subclauses with their types
 */
function extractSubclausesFromMiscellaneous(
  parentClauseNo: string,
  blockText: string,
  repositoryClauses: Clause[]
): ExtractedClause[] {
  const subclauses: ExtractedClause[] = [];

  // Pattern to match subclauses like "Section 8.1", "8.1", "(a)", "(1)", etc.
  // This regex splits on subclause markers while preserving them
  const subclausePatterns = [
    // Section X.Y format (e.g., "Section 8.1", "Section 8.2")
    /(?=(?:Section\s+)?\d+\.\d+[\s.:])/gi,
    // Parenthetical format (e.g., "(a)", "(1)")
    /(?=\([a-z0-9]\)\s+)/gi,
  ];

  let subBlocks: string[] = [];

  // Try Section X.Y format first
  const sectionDecimalRegex = /(?=(?:Section\s+)?\d+\.\d+[\s.:])/gi;
  subBlocks = blockText.split(sectionDecimalRegex).filter(b => b.trim().length > 20);

  // If no good splits, try parenthetical format
  if (subBlocks.length < 2) {
    const parenRegex = /(?=\([a-z0-9]\)\s+)/gi;
    subBlocks = blockText.split(parenRegex).filter(b => b.trim().length > 20);
  }

  // If still no good splits, try splitting on double newlines or clear breaks
  if (subBlocks.length < 2) {
    subBlocks = blockText.split(/\n\s*\n/).filter(b => b.trim().length > 30);
  }

  console.log(`Miscellaneous section: found ${subBlocks.length} potential subclauses`);

  for (const subBlock of subBlocks) {
    const trimmedSub = subBlock.trim();
    if (trimmedSub.length < 30) continue;

    // Detect the clause type for this subclause
    let subclauseType = detectMiscellaneousSubclauseType(trimmedSub);

    // If no specific type detected, try repository matching
    if (!subclauseType && repositoryClauses.length > 0) {
      const repoMatch = findBestClauseTypeMatch(trimmedSub, repositoryClauses);
      if (repoMatch && repoMatch.score > 0.15) {
        subclauseType = repoMatch.clauseType;
      }
    }

    // Only extract if we can identify a specific type
    if (subclauseType) {
      // Extract the subclause number/reference if present
      let subclauseText = trimmedSub;

      // Try to extract the subclause reference (e.g., "Section 8.3" or "8.3")
      const subRefMatch = trimmedSub.match(/^(?:Section\s+)?(\d+\.\d+)[\s.:]+(.+)$/si);
      if (subRefMatch) {
        subclauseText = subRefMatch[0]; // Keep the full text including the subclause number
      }

      subclauses.push({
        clause_type: subclauseType,
        clause_no: parentClauseNo,  // Use parent's clause_no (e.g., "SECTION 8. MISCELLANEOUS")
        clause_text: normalizeText(subclauseText),
        preferred_position: `Standard legal position for ${subclauseType}`,
        party_role: "Neutral",
        complexity: 5,
        balance: 0,
        matched_from_repository: false,
        similarity_score: 0,
      });

      console.log(`Extracted subclause: type="${subclauseType}" from miscellaneous section`);
    }
  }

  return subclauses;
}

/**
 * Detect the primary numbering schema used in the document
 * Returns the regex pattern that best matches the document's structure
 * IMPORTANT: Only splits on MAIN section headers, keeps all sub-clauses together
 */
function detectNumberingSchema(text: string): { pattern: RegExp; type: string } {
  // Count occurrences of different MAIN section numbering patterns
  // We prioritize Roman numerals and "Section/Article" patterns as they typically denote main sections
  // A., B., C. are usually SUB-clauses and should NOT trigger splits
  const patterns = [
    // Roman numerals at start of line with ALL CAPS or Title Case text following
    {
      regex: /\n\s*(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\.\s+[A-Z][A-Z\s]/g,
      type: 'roman',
      splitRegex: /\n\s*(?=(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\.\s+[A-Z])/g
    },
    // Section/Article/Clause headers - require period after number to avoid matching "Section 2(c)" style references
    { regex: /\n\s*Section\s+(\d+)\./gi, type: 'section', splitRegex: /\n\s*(?=Section\s+\d+\.)/gi },
    { regex: /\n\s*Article\s+(\d+)/gi, type: 'article', splitRegex: /\n\s*(?=Article\s+\d+)/gi },
    { regex: /\n\s*ARTICLE\s+([IVX]+)/g, type: 'article-roman', splitRegex: /\n\s*(?=ARTICLE\s+[IVX]+)/g },
    // Numeric with ALL CAPS title (main sections like "1. DEFINITIONS")
    { regex: /\n\s*(\d+)\.\s+[A-Z][A-Z\s]{3,}/g, type: 'numeric', splitRegex: /\n\s*(?=\d+\.\s+[A-Z][A-Z])/g },
  ];

  let bestPattern = patterns[0];
  let maxCount = 0;

  for (const p of patterns) {
    const matches = text.match(p.regex);
    const count = matches ? matches.length : 0;
    console.log(`Pattern ${p.type}: ${count} matches`);
    if (count > maxCount) {
      maxCount = count;
      bestPattern = p;
    }
  }

  // If no good pattern found, default to Roman numerals
  if (maxCount < 2) {
    console.log('Few main sections detected, using Roman numeral pattern');
    bestPattern = patterns[0];
  }

  console.log(`Detected numbering schema: ${bestPattern.type} with ${maxCount} matches`);
  return { pattern: bestPattern.splitRegex, type: bestPattern.type };
}

export function extractClausesRuleBased(
  documentText: string,
  repositoryClauses: Clause[] = [],
  userSchema?: NumberingSchema
): ExtractedClause[] {
  console.log('Running rule-based clause extraction');
  console.log(`Repository has ${repositoryClauses.length} clauses for matching`);
  if (userSchema) {
    console.log(`User-specified schema: Main=${userSchema.mainClause}, Sub1=${userSchema.subClause1}, Sub2=${userSchema.subClause2}`);
  }

  // Clean the document text by removing stray page numbers
  const cleanedText = removePageNumbers(documentText);
  console.log('Removed stray page numbers from document');

  const clauses: ExtractedClause[] = [];

  // Use user-specified schema or auto-detect
  let splitRegex: RegExp | null = null;
  let mainHeaderRegex: RegExp | null = null;
  let schemaType: string;

  if (userSchema && userSchema.mainClause !== "none") {
    // Use user-specified main clause pattern
    splitRegex = getSchemaSplitRegex(userSchema.mainClause);
    mainHeaderRegex = getSchemaRegex(userSchema.mainClause);
    schemaType = userSchema.mainClause;
    console.log(`Using user-specified schema: ${schemaType}`);
  } else {
    // Auto-detect the numbering schema
    const detected = detectNumberingSchema(cleanedText);
    splitRegex = detected.pattern;
    schemaType = detected.type;
    console.log(`Auto-detected schema: ${schemaType}`);
  }

  // Split by the main clause pattern
  let initialBlocks: string[] = [];
  if (splitRegex) {
    initialBlocks = cleanedText.split(splitRegex);
    console.log(`Split into ${initialBlocks.length} blocks using ${schemaType} schema`);

    // Skip preamble: Remove the first block if it doesn't start with a main clause marker
    // The preamble is text before the first numbered clause (e.g., intro, definitions, parties)
    if (initialBlocks.length > 1 && mainHeaderRegex) {
      const firstBlock = initialBlocks[0].trim();
      const firstLine = firstBlock.split('\n')[0];
      if (!mainHeaderRegex.test(firstLine)) {
        console.log('Skipping preamble text before first clause');
        initialBlocks = initialBlocks.slice(1);
      }
    }
  }

  // If primary split yields few results, try alternative patterns
  if (initialBlocks.length < 3) {
    console.log('Few blocks found, trying alternative patterns');

    // Try Roman numerals with ALL CAPS titles
    const romanCapsRegex = /\n\s*(?=[IVX]+\.\s+[A-Z][A-Z])/g;
    let altBlocks = cleanedText.split(romanCapsRegex);

    if (altBlocks.length >= 3) {
      initialBlocks = altBlocks;
      schemaType = 'roman-upper';
    } else {
      // Try Section/Article headers - require period after number
      const sectionRegex = /\n\s*(?=(?:Section|Article|ARTICLE)\s+\d+\.)/gi;
      altBlocks = cleanedText.split(sectionRegex);

      if (altBlocks.length >= 3) {
        initialBlocks = altBlocks;
        schemaType = 'section';
      } else {
        // Try numeric with ALL CAPS (like "1. DEFINITIONS")
        const numericCapsRegex = /\n\s*(?=\d+\.\s+[A-Z][A-Z])/g;
        altBlocks = cleanedText.split(numericCapsRegex);

        if (altBlocks.length >= 3) {
          initialBlocks = altBlocks;
          schemaType = 'numeric';
        }
      }
    }
    console.log(`Alternative split: ${initialBlocks.length} blocks`);
  }

  // Get the main header regex for validation
  if (!mainHeaderRegex) {
    mainHeaderRegex = getSchemaRegex(schemaType) || /^(I{1,3}|IV|VI{0,3}|IX|XI{0,3}|XIV|XV|XVI{0,3}|XIX|XX[IVX]*)\.\s+[A-Z]/;
  }

  // Process blocks - all content stays together, no further splitting on sub-clauses
  // Sub-clauses remain with their parent main clause
  const blocks: string[] = [];

  for (let block of initialBlocks) {
    const trimmed = block.trim();
    if (trimmed.length < 10) continue;

    const firstLine = trimmed.split('\n')[0];
    const isMainSection = mainHeaderRegex.test(firstLine);

    // Only start a new block if this is a MAIN section header
    // Otherwise append to the previous block (it's a sub-clause or continuation)
    if (isMainSection || blocks.length === 0) {
      blocks.push(trimmed);
    } else {
      // This is a sub-clause or continuation - keep it with the previous main section
      blocks[blocks.length - 1] += "\n\n" + trimmed;
    }
  }

  console.log(`Final blocks after merging sub-clauses: ${blocks.length}`);

  const seenTexts = new Set<string>();

  for (const block of blocks) {
    const trimmedBlock = block.trim();
    if (trimmedBlock.length < 30) continue; // Skip very short blocks/noise
    if (seenTexts.has(trimmedBlock)) continue;
    
    // Clean up potential page noise within the block (common in PDF extracted text)
    const cleanedBlock = trimmedBlock.replace(/Agreement between.*Page\s+\d+\s+of\s+\d+.*\(01\/2021 v[^\)]*\)/gi, '').trim();
    if (cleanedBlock.length < 20) continue;

    // Parse clause number/title and separate from body text
    const { clause_no, body_text } = parseClauseNumber(cleanedBlock);
    console.log(`Parsed clause_no: "${clause_no}" | body length: ${body_text.length}`);

    // Attempt to extract prefix/title from the block if it looks like a header
    const { title, text } = parseHeader(cleanedBlock);

    let detectedType = title || detectClauseType(cleanedBlock);
    let matchedFromRepo = false;
    let similarityScore = 0;

    // Try repository matching for better clause type detection
    if (repositoryClauses.length > 0) {
      const repoMatch = findBestClauseTypeMatch(cleanedBlock, repositoryClauses);

      if (repoMatch) {
        // If repository match found with good confidence, use it
        // Prefer repo match over rule-based detection when:
        // 1. Rule-based returned null/General Clause, OR
        // 2. Repository match has high confidence (> 0.2)
        if (!detectedType || detectedType === "General Clause" || repoMatch.score > 0.2) {
          console.log(`Repository match found: ${repoMatch.clauseType} (score: ${repoMatch.score.toFixed(3)})`);
          detectedType = repoMatch.clauseType;
          matchedFromRepo = true;
          similarityScore = repoMatch.score;
        }
      }
    }

    // If no specific type detected but it looks like a substantial legal block,
    // label it as "General Clause" so we don't lose it
    if (!detectedType && (cleanedBlock.length > 100 || /shall|hereby|party|agreement/i.test(cleanedBlock))) {
      detectedType = "General Clause";
    }

    if (detectedType) {
      // Check if this is a miscellaneous/general section that should have subclauses extracted
      if (isMiscellaneousOrGeneralSection(clause_no)) {
        console.log(`Detected miscellaneous/general section: "${clause_no}"`);

        // Extract subclauses from this section
        const extractedSubclauses = extractSubclausesFromMiscellaneous(
          clause_no,
          cleanedBlock,  // Use the full block text to find subclauses
          repositoryClauses
        );

        if (extractedSubclauses.length > 0) {
          // Add the extracted subclauses as separate clauses
          for (const subclause of extractedSubclauses) {
            clauses.push(subclause);
          }
          console.log(`Added ${extractedSubclauses.length} subclauses from miscellaneous section`);
        } else {
          // If no subclauses were extracted, add the main clause as usual
          clauses.push({
            clause_type: detectedType,
            clause_no: clause_no,
            clause_text: normalizeText(body_text),
            preferred_position: "Standard legal position for " + detectedType,
            party_role: "Neutral",
            complexity: 5,
            balance: 0,
            matched_from_repository: matchedFromRepo,
            similarity_score: similarityScore,
          });
        }
      } else {
        // Regular clause - add as usual
        clauses.push({
          clause_type: detectedType,
          clause_no: clause_no,  // The number/title (e.g., "8. Services for Others")
          clause_text: normalizeText(body_text),  // Normalized body text without extra line breaks
          preferred_position: "Standard legal position for " + detectedType,
          party_role: "Neutral",
          complexity: 5,
          balance: 0,
          matched_from_repository: matchedFromRepo,
          similarity_score: similarityScore,
        });
      }
      seenTexts.add(trimmedBlock);
    }
  }

  return clauses;
}

/**
 * Parses a block to extract the clause number/title and separate it from the body text
 * Returns the clause_no (e.g., "8. Services for Others") and the body text
 */
function parseClauseNumber(block: string): { clause_no: string; body_text: string } {
  const trimmed = block.trim();

  // Pattern 1: "8. Services for Others. Body text..." or "8. Services for Others\nBody text..."
  // Match: number/roman numeral + period + title + (period or newline) + body
  const numberedWithTitleMatch = trimmed.match(/^((?:\d+|[IVX]+|[A-Z])\.\s*[^\n.]+?)(?:\.\s*|\n\s*)(.+)$/s);
  if (numberedWithTitleMatch) {
    return {
      clause_no: numberedWithTitleMatch[1].trim(),
      body_text: numberedWithTitleMatch[2].trim()
    };
  }

  // Pattern 2: "Section 8. Services for Others. Body text..."
  const sectionMatch = trimmed.match(/^((?:Section|Article|ARTICLE|Clause)\s+(?:\d+|[IVX]+)\.?\s*[^\n.]*?)(?:\.\s*|\n\s*)(.+)$/si);
  if (sectionMatch) {
    return {
      clause_no: sectionMatch[1].trim(),
      body_text: sectionMatch[2].trim()
    };
  }

  // Pattern 3: Just a number/letter prefix with no clear title - take first line as clause_no
  const simpleNumberMatch = trimmed.match(/^((?:\d+|[IVX]+|[A-Z])\.)\s*(.+)$/s);
  if (simpleNumberMatch) {
    // Check if there's a clear title in the first line
    const firstLineEnd = simpleNumberMatch[2].indexOf('\n');
    if (firstLineEnd > 0 && firstLineEnd < 100) {
      const firstLine = simpleNumberMatch[2].substring(0, firstLineEnd).trim();
      const rest = simpleNumberMatch[2].substring(firstLineEnd).trim();
      // Check if first line looks like a title (short, possibly ALL CAPS or Title Case)
      if (firstLine.length < 80 && rest.length > 0) {
        return {
          clause_no: simpleNumberMatch[1] + ' ' + firstLine,
          body_text: rest
        };
      }
    }
    // Otherwise, the whole thing after the number is the body
    return {
      clause_no: simpleNumberMatch[1],
      body_text: simpleNumberMatch[2].trim()
    };
  }

  // Pattern 4: ALL CAPS TITLE at start followed by body
  const allCapsMatch = trimmed.match(/^([A-Z][A-Z\s]{3,50})(?:\.\s*|\n\s*)(.+)$/s);
  if (allCapsMatch) {
    return {
      clause_no: allCapsMatch[1].trim(),
      body_text: allCapsMatch[2].trim()
    };
  }

  // No clear clause number found - use empty string for clause_no
  return {
    clause_no: '',
    body_text: trimmed
  };
}

/**
 * Parses a block to see if it starts with a header-like pattern
 * Returns the potential title and the remaining text
 */
function parseHeader(block: string): { title: string | null, text: string } {
  // Pattern 1: A. INDEMNITY or 1. Independent Contractor or I. INDEMNITY
  // Match a number/letter prefix followed by a dot and then some text
  // We're more liberal now: Title can be mixed case and doesn't need to end in a dot
  const numberedHeaderMatch = block.match(/^([0-9]+|[A-Z]|[IVX]+)\.\s+([A-Z][A-Za-z\s,\/\(\)]{3,100})(?:\n|\.|\s{2,}|$|(?=\s+[0-9]+\.[0-9]+))/);
  if (numberedHeaderMatch) {
    return { title: cleanTitle(numberedHeaderMatch[2]), text: block };
  }

  // Fallback for very simple headers like "Section 1" or "1. Term"
  const simpleNumberedMatch = block.match(/^([0-9]+|[A-Z]|[IVX]+)\.\s+([^\n.]+)(?:\n|\.|$)/);
  if (simpleNumberedMatch) {
    const potTitle = simpleNumberedMatch[2].trim();
    if (potTitle.length > 2 && potTitle.length < 100) {
      return { title: cleanTitle(potTitle), text: block };
    }
  }

  // Pattern 2: Section 1. INDEMNITY or Section 1: Independent Contractor
  const sectionMatch = block.match(/^(?:Section|Article|Clause)\s+[0-9A-ZIVX]+\.?\s*([^\n.]+)?(?:\n|\.|$)/i);
  if (sectionMatch && sectionMatch[1]) {
    const potTitle = sectionMatch[1].trim();
    if (potTitle.length > 2 && potTitle.length < 100) {
      return { title: cleanTitle(potTitle), text: block };
    }
  }

  // Pattern 3: ALL CAPS TITLE at the start
  const allCapsMatch = block.match(/^([A-Z\s]{4,})(?:\n|$)/);
  if (allCapsMatch) {
    return { title: cleanTitle(allCapsMatch[1]), text: block };
  }

  return { title: null, text: block };
}

function cleanTitle(title: string): string {
  // Convert to Title Case or keep as is if short, and trim
  const trimmed = title.trim();
  if (trimmed.length > 50) return trimmed.substring(0, 47) + "...";
  
  // Try to normalize to common legal types if possible
  const lower = trimmed.toLowerCase();
  
  const mappings: { [key: string]: string } = {
    "indemnity": "Indemnification",
    "indemnification": "Indemnification",
    "limitation of liability": "Liability Cap",
    "liability": "Liability Cap",
    "confidentiality": "Confidentiality",
    "proprietary": "Confidentiality",
    "termination": "Termination",
    "term": "Termination",
    "force majeure": "Force Majeure",
    "intellectual property": "Ip Ownership",
    "ip": "Ip Ownership",
    "ownership": "Ip Ownership",
    "warranty": "Warranty Duration",
    "guarantee": "Warranty Duration",
    "payment": "Payment Terms",
    "fee": "Payment Terms",
    "non-compete": "Non-Compete",
    "noncompete": "Non-Compete",
    "governing law": "Governing Law",
    "law": "Governing Law",
    "assignment": "Anti-Assignment",
    "transfer": "Anti-Assignment",
    "notice": "Notice Period",
    "most favored nation": "Most Favored Nation",
    "exclusivity": "Exclusivity",
    "solicit": "No-Solicit",
    "disparage": "Non-Disparagement",
    "rofr": "Rofr/Rofo/Rofn",
    "rofo": "Rofr/Rofo/Rofn",
    "refusal": "Rofr/Rofo/Rofn",
    "change of control": "Change of Control",
    "revenue": "Revenue/Profit Sharing",
    "profit": "Revenue/Profit Sharing",
    "sharing": "Revenue/Profit Sharing",
    "commitment": "Minimum Commitment",
    "restriction": "Volume Restriction",
    "license": "License Grant",
    "escrow": "Source Code Escrow",
    "audit": "Audit Rights",
    "liquidated": "Liquidated Damages",
    "insurance": "Insurance",
    "effective": "Effective Date",
    "expiration": "Expiration Date",
    "renewal": "Renewal Term"
  };

  for (const [key, value] of Object.entries(mappings)) {
    if (lower.includes(key)) return value;
  }
  
  return trimmed;
}

function detectClauseType(text: string): string | null {
  const lowercaseText = text.toLowerCase();
  const first200Chars = lowercaseText.substring(0, 200).trim();
  
  // High priority: First 50 chars for very clear headers
  const veryEarly = lowercaseText.substring(0, 50);
  if (veryEarly.includes("between") && veryEarly.includes("party")) return "Parties";
  if (veryEarly.includes("agreement") && (veryEarly.includes("made") || veryEarly.includes("dated"))) return "Document Name";

  // Common keywords in the start of the clause
  if (first200Chars.includes("confidential") || first200Chars.includes("proprietary")) return "Confidentiality";
  if (first200Chars.includes("liability") || first200Chars.includes("cap") || first200Chars.includes("uncapped")) return "Liability Cap";
  if (first200Chars.includes("indemnif")) return "Indemnification";
  if (first200Chars.includes("terminat")) return "Termination";
  if (first200Chars.includes("payment") || first200Chars.includes("fee") || first200Chars.includes("royalty")) return "Payment Terms";
  if (first200Chars.includes("intellectual") || first200Chars.includes("ipr") || first200Chars.includes("ownership")) return "Ip Ownership";
  if (first200Chars.includes("law") || first200Chars.includes("jurisdiction")) return "Governing Law";
  if (first200Chars.includes("arbitration") || first200Chars.includes("dispute")) return "Dispute Resolution";
  if (first200Chars.includes("notice")) return "Notice Period";
  if (first200Chars.includes("force majeure")) return "Force Majeure";
  if (first200Chars.includes("severability") || first200Chars.includes("invalid")) return "Severability";
  if (first200Chars.includes("assignment") || first200Chars.includes("transfer")) return "Anti-Assignment";
  if (first200Chars.includes("warranty") || first200Chars.includes("guarantee")) return "Warranty Duration";
  if (first200Chars.includes("favored nation")) return "Most Favored Nation";
  if (first200Chars.includes("non-compete") || first200Chars.includes("noncompete")) return "Non-Compete";
  if (first200Chars.includes("exclusiv")) return "Exclusivity";
  if (first200Chars.includes("non-disparage") || first200Chars.includes("nondisparage")) return "Non-Disparagement";
  if (first200Chars.includes("solicit")) return "No-Solicit";
  if (first200Chars.includes("change of control")) return "Change of Control";
  if (first200Chars.includes("first refusal") || first200Chars.includes("rofr")) return "Rofr/Rofo/Rofn";
  if (first200Chars.includes("revenue share") || first200Chars.includes("profit share")) return "Revenue/Profit Sharing";
  if (first200Chars.includes("price restriction")) return "Price Restrictions";
  if (first200Chars.includes("minimum commitment") || first200Chars.includes("commits to purchase")) return "Minimum Commitment";
  if (first200Chars.includes("volume restriction")) return "Volume Restriction";
  if (first200Chars.includes("license") || first200Chars.includes("grant")) return "License Grant";
  if (first200Chars.includes("escrow")) return "Source Code Escrow";
  if (first200Chars.includes("audit")) return "Audit Rights";
  if (first200Chars.includes("liquidated damages")) return "Liquidated Damages";
  if (first200Chars.includes("insurance")) return "Insurance";
  if (first200Chars.includes("covenant not to sue")) return "Covenant Not To Sue";
  if (first200Chars.includes("third party beneficiary")) return "Third Party Beneficiary";
  if (first200Chars.includes("effective date")) return "Effective Date";
  if (first200Chars.includes("expiration date")) return "Expiration Date";
  if (first200Chars.includes("renewal term")) return "Renewal Term";
  
  // Fallback: Check anywhere in the text if it's a shorter block
  if (text.length < 1500) {
    for (const type of commonClauseTypes) {
      if (lowercaseText.includes(type.toLowerCase())) {
        return type;
      }
    }
  }
  
  return null;
}

export function analyzeClauseRuleBased(clauseText: string, action: string): any {
  const lowercaseText = clauseText.toLowerCase();
  
  if (action === 'analyze') {
    const risks = [];
    if (lowercaseText.includes("indemnif")) {
      risks.push("Broad indemnification obligations detected. Check for reciprocity.");
    }
    if (lowercaseText.includes("liability") && !lowercaseText.includes("cap")) {
      risks.push("No clear liability cap found in this text.");
    }
    if (lowercaseText.includes("sole discretion") || lowercaseText.includes("sole option")) {
      risks.push("One-sided discretionary power found.");
    }
    if (lowercaseText.includes("consequential damages")) {
        risks.push("Exclusion of consequential damages should be mutual.");
    }
    if (lowercaseText.includes("automatic renewal") || lowercaseText.includes("evergreen")) {
        risks.push("Automatic renewal clause detected. Monitor expiration dates.");
    }
    
    if (risks.length === 0) {
      risks.push("Standard Clause Review: No high-risk keywords detected in this snippet.");
      risks.push("Note: Rule-based analysis is less comprehensive than AI.");
    }
    return { risks };
  }

  if (action === 'compliance') {
    return {
      compliance: {
        status: 'warning',
        findings: ["Rule-based engine cannot perform full playbook comparison."],
        recommendations: ["Manually compare this clause against your uploaded playbook rules."]
      }
    };
  }

  if (action === 'improve') {
    const improvements = [
      "Ensure all defined terms are used consistently.",
      "Consider adding a 'reasonableness' standard to discretionary actions.",
      "Be specific about timelines (e.g., 'within 30 days' instead of 'promptly')."
    ];
    return { improvements };
  }

  if (action === 'balance') {
    let score = 0;
    let explanation = "This clause appears to be relatively balanced based on standard keyword analysis.";
    
    if (lowercaseText.includes("at its sole option") || lowercaseText.includes("sole discretion")) {
      score = 3;
      explanation = "This clause favors the party with discretionary power.";
    } else if (lowercaseText.includes("mutual")) {
      score = 0;
      explanation = "This clause is mutual, which is generally considered balanced.";
    }
    
    return { balance: { score, explanation } };
  }

  if (action === 'alternatives') {
    return { 
      alternatives: [
        "Alternative 1: [Standard mutual version of the clause]",
        "Alternative 2: [Version with limited liability cap]"
      ] 
    };
  }

  return {};
}
