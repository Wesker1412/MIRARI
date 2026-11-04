import crypto from 'crypto';

/**
 * Compute SHA-256 hash helper
 */
export function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Parse frontmatter and markdown body
 */
export function parseFrontmatter(rawContent) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error('Article format invalid: Missing YAML frontmatter delimited by ---');
  }

  const yamlStr = match[1];
  const bodyMarkdown = match[2].trim();

  // Simple, robust YAML parser for key-value, lists, and nested arrays
  const metadata = {};
  const lines = yamlStr.split(/\r?\n/);
  let currentKey = null;
  let currentList = null;
  let currentObjectInList = null;

  for (let line of lines) {
    line = line.trimEnd();
    if (!line || line.startsWith('#')) continue;

    // List item with object (e.g. "  - name: ...")
    if (line.match(/^\s*-\s+([a-zA-Z0-9_]+):\s*(.*)$/)) {
      const m = line.match(/^\s*-\s+([a-zA-Z0-9_]+):\s*(.*)$/);
      const prop = m[1];
      const val = cleanYamlVal(m[2]);
      currentObjectInList = { [prop]: val };
      if (!currentList) {
        currentList = [];
        metadata[currentKey] = currentList;
      }
      currentList.push(currentObjectInList);
      continue;
    }

    // List item with continuation prop (e.g. "    role: ...")
    if (line.match(/^\s+([a-zA-Z0-9_]+):\s*(.*)$/) && currentObjectInList) {
      const m = line.match(/^\s+([a-zA-Z0-9_]+):\s*(.*)$/);
      const prop = m[1];
      currentObjectInList[prop] = cleanYamlVal(m[2]);
      continue;
    }

    // Sub-property under a parent object key (e.g. "  journal: ...")
    const subPropMatch = line.match(/^\s{2,4}([a-zA-Z0-9_]+):\s*(.*)$/);
    if (subPropMatch && currentKey && !currentList && !currentObjectInList) {
      if (typeof metadata[currentKey] !== 'object' || metadata[currentKey] === null) {
        metadata[currentKey] = {};
      }
      metadata[currentKey][subPropMatch[1]] = cleanYamlVal(subPropMatch[2].trim());
      continue;
    }

    // Simple list item (e.g. "  - item")
    if (line.match(/^\s*-\s+(.*)$/)) {
      const val = cleanYamlVal(line.match(/^\s*-\s+(.*)$/)[1]);
      if (!currentList) {
        currentList = [];
        metadata[currentKey] = currentList;
      }
      currentList.push(val);
      continue;
    }

    // Key-value pair (e.g. "key: value")
    const kvMatch = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      currentObjectInList = null;
      const rawVal = kvMatch[2].trim();
      if (rawVal === '') {
        currentList = null; // List expected on next lines
      } else {
        currentList = null;
        metadata[currentKey] = cleanYamlVal(rawVal);
      }
    }
  }

  return { metadata, bodyMarkdown };
}

function cleanYamlVal(str) {
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (!isNaN(Number(str)) && str !== '') return Number(str);
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1).replace(/\\"/g, '"');
  }
  return str;
}

/**
 * Intelligent CJK-aware sentence splitter
 * Preserves quotes, math blocks, and formulas without premature cuts.
 */
export function splitIntoCanonicalSentences(paragraphText) {
  if (!paragraphText || !paragraphText.trim()) return [];

  const sentences = [];
  let current = '';
  let inDoubleQuote = false;
  let inCJKQuote = false;
  let inMath = false;

  for (let i = 0; i < paragraphText.length; i++) {
    const char = paragraphText[i];

    if (char === '"') inDoubleQuote = !inDoubleQuote;
    if (char === '「') inCJKQuote = true;
    if (char === '」') inCJKQuote = false;
    if (char === '$') inMath = !inMath;

    current += char;

    // Check sentence delimiter outside of quotes and math
    if (!inDoubleQuote && !inCJKQuote && !inMath) {
      if (char === '。' || char === '！' || char === '？' || char === '!' || char === '?') {
        const nextChar = paragraphText[i + 1];
        // Don't break if followed immediately by closing quote
        if (nextChar === '」' || nextChar === '"' || nextChar === "'") {
          current += nextChar;
          i++;
        }
        // Keep closing emphasis with the sentence that opened it.
        const closingEmphasis = paragraphText.slice(i + 1).match(/^(\*{1,3}|_{1,3})(?![*_])/);
        if (closingEmphasis) {
          const marker = closingEmphasis[0];
          const runs = current.match(/(?<!\\)[*_]+/g) || [];
          if (runs.filter((run) => run === marker).length % 2 === 1) {
            current += marker;
            i += marker.length;
          }
        }
        const trimmed = current.trim();
        if (trimmed.length > 0) {
          sentences.push(trimmed);
        }
        current = '';
      }
    }
  }

  const remaining = current.trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  return sentences;
}

/**
 * Full Article Document Parsing
 */
export function parseArticleDocument(rawContent, filePath = '') {
  // Sentence and chunk hashes must match across Windows and Linux checkouts.
  const { metadata, bodyMarkdown } = parseFrontmatter(rawContent.replace(/\r\n/g, '\n'));

  // Validate required metadata
  const required = ['id', 'slug', 'title', 'status', 'references', 'editorialCategory'];
  for (const field of required) {
    if (!metadata[field]) {
      throw new Error(`Article validation failed (${filePath}): Missing required field "${field}"`);
    }
  }

  const validEditorialCategories = ['scientific_principles', 'journal_interpretation'];
  if (!validEditorialCategories.includes(metadata.editorialCategory)) {
    throw new Error(
      `Article validation failed (${filePath}): Invalid editorialCategory "${metadata.editorialCategory}". Must be "scientific_principles" or "journal_interpretation"`
    );
  }

  const articleId = metadata.id;
  const sections = [];
  const allSentences = [];
  const allChunks = [];

  // Split markdown by Level 1 or Level 2 headings: "# " or "## "
  const rawSections = bodyMarkdown.split(/(?=^#{1,2}\s+)/m);
  let globalCharOffset = 0;

  for (let sIdx = 0; sIdx < rawSections.length; sIdx++) {
    const rawSec = rawSections[sIdx].trim();
    if (!rawSec) continue;

    const headingMatch = rawSec.match(/^(#{1,3})\s+(.*)$/m);
    let secTitle = `章節 ${sIdx + 1}`;
    let secLevel = 2;
    let secBody = rawSec;

    if (headingMatch) {
      secLevel = headingMatch[1].length;
      secTitle = headingMatch[2].trim();
      secBody = rawSec.slice(headingMatch[0].length).trim();
    }

    const secId = `sec-${sIdx + 1}-${sha256(secTitle).slice(0, 6)}`;
    const paragraphs = secBody
      .split(/\r?\n\r?\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const secSentences = [];
    const secFormulas = [];
    let interactiveComponentId = null;

    for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
      const pText = paragraphs[pIdx];

      // Check if paragraph is an interactive component tag
      const compMatch = pText.match(/<InteractiveExperiment\s+id=["']([^"']+)["']\s*\/>/);
      if (compMatch) {
        interactiveComponentId = compMatch[1];
        continue;
      }

      // Check if paragraph is a standalone math block
      if (pText.startsWith('$$') && pText.endsWith('$$')) {
        secFormulas.push(pText);
        continue;
      }

      // Split paragraph into canonical sentences
      const rawSentences = splitIntoCanonicalSentences(pText);

      // Create Chunk for Vector & Keyword indexing (contextual: title + paragraph)
      const chunkText = `${secTitle}\n${pText}`;
      const chunkHash = sha256(chunkText);
      const chunkId = `${articleId}-chk-${sIdx}-${pIdx}-${chunkHash.slice(0, 6)}`;

      allChunks.push({
        id: chunkId,
        articleId,
        sectionId: secId,
        sectionTitle: secTitle,
        chunkIndex: allChunks.length,
        content: pText,
        contextContent: chunkText,
        contentHash: chunkHash,
        charStart: globalCharOffset,
        charEnd: globalCharOffset + pText.length,
      });

      for (let sentIdx = 0; sentIdx < rawSentences.length; sentIdx++) {
        const sentenceText = rawSentences[sentIdx];
        const sentHash = sha256(sentenceText);
        const sentenceId = `sent-${sentHash.slice(0, 8)}`;

        const sentenceObj = {
          sentenceId,
          articleId,
          sectionId: secId,
          sectionTitle: secTitle,
          paragraphIndex: pIdx,
          exactQuote: sentenceText,
          charStart: globalCharOffset,
          charEnd: globalCharOffset + sentenceText.length,
          contentHash: sentHash,
          contextNote: `${secTitle} · 第 ${pIdx + 1} 段`,
        };

        secSentences.push(sentenceObj);
        allSentences.push(sentenceObj);
        globalCharOffset += sentenceText.length + 1;
      }

      globalCharOffset += pText.length + 2;
    }

    sections.push({
      id: secId,
      title: secTitle,
      level: secLevel,
      paragraphs,
      sentences: secSentences,
      formulas: secFormulas,
      interactiveComponentId,
    });
  }

  const contentHash = sha256(rawContent);

  const document = {
    ...metadata,
    version: metadata.version || 1,
    contentHash,
    sections,
    totalWordCount: bodyMarkdown.replace(/\s+/g, '').length,
    lastIndexedAt: new Date().toISOString(),
  };

  return {
    document,
    sentences: allSentences,
    chunks: allChunks,
  };
}
