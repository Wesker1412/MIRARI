import React from 'react';
import { renderInlineContent, renderMathToHtml } from './inlineMarkdown';
import type { ArticleDocument, ArticleSection, SentenceEvidence } from '../../types';
import { getInteractiveComponent } from '../interactive/registry';

interface ArticleRendererProps {
  document: ArticleDocument;
  getHighlightClass: (sentenceId: string) => string;
}

/**
 * Helper to clean heading or list markers from sentence text
 */
function stripMarkdownBlockPrefix(text: string): string {
  // Strip leading heading: ### ...\n
  let clean = text.replace(/^(#{1,6})\s+[^\r\n]*\r?\n?/, '');
  // Strip list markers: 1. or - or *
  clean = clean.replace(/^(\d+\.|[-*+])\s+/, '');
  // Strip blockquote markers
  clean = clean.replace(/^>\s*/gm, '');
  return clean.trim();
}

function getSentencePortionForLine(line: string, sentQuote: string): string {
  const cleanLine = stripMarkdownBlockPrefix(line);
  const cleanQuote = stripMarkdownBlockPrefix(sentQuote);
  if (cleanLine.includes(cleanQuote)) return cleanQuote;
  for (const qLine of cleanQuote.split(/\r?\n/)) {
    const cleanQ = stripMarkdownBlockPrefix(qLine);
    if (cleanQ && cleanLine.includes(cleanQ)) return cleanQ;
  }
  return cleanLine;
}

/**
 * Helper to group continuation lines in a list item together with their parent item
 */
function parseListItems(lines: string[]): string[] {
  const items: string[] = [];
  let currentItem = '';

  for (const line of lines) {
    const isNewItem = /^([-*+]|\d+\.)\s+/.test(line.trim());
    if (isNewItem) {
      if (currentItem.length > 0) {
        items.push(currentItem);
      }
      currentItem = line;
    } else if (currentItem.length > 0) {
      currentItem += '\n' + line;
    } else {
      currentItem = line;
    }
  }
  if (currentItem.length > 0) {
    items.push(currentItem);
  }
  return items;
}

export const ArticleRenderer: React.FC<ArticleRendererProps> = ({
  document,
  getHighlightClass,
}) => {
  // Track sentence IDs emitted across the entire article document to guarantee 100% uniqueness in DOM
  const usedSentenceIds = new Set<string>();

  const getSafeSentenceId = (sentId?: string): string | undefined => {
    if (!sentId) return undefined;
    if (usedSentenceIds.has(sentId)) return undefined;
    usedSentenceIds.add(sentId);
    return sentId;
  };

  const hasTextContent = (text?: string): boolean => {
    if (!text) return false;
    return /[\p{L}\p{N}]/u.test(text);
  };

  const getSentencesForLine = (
    line: string,
    sentences: SentenceEvidence[]
  ): SentenceEvidence[] => {
    const cleanLine = stripMarkdownBlockPrefix(line);
    if (!cleanLine) return [];
    return sentences.filter((s) => {
      const cleanQuote = stripMarkdownBlockPrefix(s.exactQuote);
      if (!cleanQuote || cleanQuote === '**') return false;
      if (cleanLine.includes(cleanQuote) || cleanQuote.includes(cleanLine)) return true;
      return cleanQuote.split(/\r?\n/).some((qLine) => {
        const cleanQ = stripMarkdownBlockPrefix(qLine);
        return (
          cleanQ &&
          (cleanLine.includes(cleanQ) ||
            cleanQ.includes(cleanLine) ||
            cleanLine.slice(0, 15).includes(cleanQ.slice(0, 15)) ||
            cleanQ.slice(0, 15).includes(cleanLine.slice(0, 15)))
        );
      });
    });
  };

  return (
    <article className="space-y-10 text-base sm:text-[17px] leading-[1.85] font-sans text-mirari-ink">
      {/* ─── Quote Lead (引言) ────────────────────────────────────── */}
      {document.quoteLead && (
        <div className="my-8 pl-5 border-l-2 border-mirari-amber py-1">
          <p className="font-serif text-base sm:text-lg text-mirari-ink leading-relaxed italic">
            「{renderInlineContent(document.quoteLead)}」
          </p>
        </div>
      )}

      {/* ─── Structured Sections ──────────────────────────────────── */}
      {document.sections &&
        document.sections.map((section: ArticleSection) => (
          <section key={section.id} id={section.id} className="space-y-5 pt-2">
            {/* Section Heading */}
            <h2 className="font-serif text-2xl font-bold text-mirari-ink tracking-tight pt-2">
              {section.title}
            </h2>

            {/* Section Paragraphs & Structured Markdown Blocks */}
            {section.paragraphs.map((paraText, pIdx) => {
              // 1. Embedded Interactive Simulation Component
              if (paraText.includes('<InteractiveExperiment')) {
                const match = paraText.match(/id=["']([^"']+)["']/);
                const compId = match
                  ? match[1]
                  : section.interactiveComponentId || document.interactiveComponent || 'TransitSimulator';
                const compMeta = getInteractiveComponent(compId);
                if (compMeta) {
                  const Component = compMeta.component;
                  return (
                    <div key={pIdx} className="my-8 space-y-3">
                      <Component />
                    </div>
                  );
                }
              }

              // 2. Standalone Display Math Block: $$...$$ or \[...\]
              const isDisplayMath =
                (paraText.startsWith('$$') && paraText.endsWith('$$')) ||
                (paraText.startsWith('\\[') && paraText.endsWith('\\]'));

              if (isDisplayMath) {
                const formula = paraText.slice(2, -2).trim();
                return (
                  <div
                    key={pIdx}
                    className="my-6 py-5 px-4 bg-mirari-paper border-y border-mirari-line rounded-xl overflow-x-auto text-center"
                  >
                    <div
                      className="inline-block min-w-full text-base sm:text-lg text-mirari-ink"
                      dangerouslySetInnerHTML={{ __html: renderMathToHtml(formula, true) }}
                    />
                  </div>
                );
              }

              // 3. Fenced Code Block: ```...```
              if (paraText.startsWith('```')) {
                const match = paraText.match(/^```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)\r?\n```$/);
                const lang = match ? match[1].trim() : '';
                const codeContent = match ? match[2] : paraText.slice(3, -3).trim();
                return (
                  <div
                    key={pIdx}
                    className="my-6 overflow-hidden rounded-xl border border-mirari-line bg-mirari-paper"
                  >
                    {lang && (
                      <div className="border-b border-mirari-line px-4 py-1.5 bg-mirari-paper-dark text-[11px] font-mono text-mirari-dim uppercase tracking-wider">
                        {lang}
                      </div>
                    )}
                    <pre className="overflow-x-auto p-4 font-mono text-xs sm:text-sm text-mirari-ink leading-relaxed">
                      <code>{codeContent}</code>
                    </pre>
                  </div>
                );
              }

              // Retrieve matching canonical sentences for this paragraph index
              const matchingSentences = (section.sentences || []).filter(
                (s: SentenceEvidence) => s.paragraphIndex === pIdx
              );

              // 4. Markdown Table: | Col 1 | Col 2 |
              const rawLines = paraText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
              const isTable =
                rawLines.length >= 2 &&
                rawLines[0].startsWith('|') &&
                rawLines[0].endsWith('|') &&
                rawLines[1].includes('---');

              if (isTable) {
                const primarySent = matchingSentences[0];
                const safeBlockId = getSafeSentenceId(primarySent?.sentenceId);
                const headers = rawLines[0]
                  .split('|')
                  .map((s) => s.trim())
                  .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
                const delims = rawLines[1]
                  .split('|')
                  .map((s) => s.trim())
                  .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
                const alignments = delims.map((d) => {
                  const left = d.startsWith(':');
                  const right = d.endsWith(':');
                  if (left && right) return 'center';
                  if (right) return 'right';
                  return 'left';
                });
                const rows = rawLines.slice(2).map((r) =>
                  r
                    .split('|')
                    .map((s) => s.trim())
                    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
                );
                return (
                  <div key={pIdx} id={safeBlockId} data-sentence-id={safeBlockId} className="my-6 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <div className="inline-block min-w-full align-middle">
                      <table className="min-w-full text-left text-sm border-collapse border border-mirari-line rounded-lg overflow-hidden">
                        <thead className="bg-mirari-paper-dark border-b border-mirari-line font-serif font-bold text-mirari-ink">
                          <tr>
                            {headers.map((h, i) => (
                              <th
                                key={i}
                                className={`p-3 text-${alignments[i] || 'left'} border-r border-mirari-line last:border-r-0`}
                              >
                                {renderInlineContent(h)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-mirari-line font-sans">
                          {rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-mirari-paper-dark/40 transition-colors">
                              {row.map((cell, cIdx) => (
                                <td
                                  key={cIdx}
                                  className={`p-3 text-${alignments[cIdx] || 'left'} border-r border-mirari-line last:border-r-0 text-mirari-ink`}
                                >
                                  {renderInlineContent(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // 5. Blockquote: Lines starting with >
              const isBlockquote = rawLines.every((l) => l.startsWith('>'));
              if (isBlockquote) {
                const quoteLines = rawLines.map((l) => l.replace(/^\s*>\s?/, ''));
                const primarySent = matchingSentences[0];
                const safeBlockId = getSafeSentenceId(primarySent?.sentenceId);
                return (
                  <blockquote
                    key={pIdx}
                    id={safeBlockId}
                    className={`my-6 pl-5 border-l-2 border-mirari-amber py-2 space-y-2 font-serif text-mirari-ink italic bg-mirari-amber/5 rounded-r-lg ${primarySent ? getHighlightClass(primarySent.sentenceId) : ''}`}
                  >
                    {quoteLines.map((line, lIdx) => (
                      <p key={lIdx} className="leading-relaxed">
                        {renderInlineContent(line)}
                      </p>
                    ))}
                  </blockquote>
                );
              }

              // 6. Subheading at start of paragraph: ### or #### or ## or #
              const isHeadingStart = /^#{1,6}\s+/.test(paraText);
              if (isHeadingStart) {
                const headingMatch = paraText.match(/^(#{1,6})\s+([^\r\n]+)/);
                if (headingMatch) {
                  const level = headingMatch[1].length;
                  const headingTitle = headingMatch[2].trim();

                  // Find if matchingSentences has a sentence that represents this standalone heading
                  const headingSent = matchingSentences.find((s) => {
                    if (!s.exactQuote.startsWith('#')) return false;
                    const afterHeading = s.exactQuote.replace(/^(#{1,6})\s+[^\r\n]*\r?\n?/, '').trim();
                    return afterHeading.length === 0;
                  });
                  const safeHeadingId = headingSent ? getSafeSentenceId(headingSent.sentenceId) : undefined;
                  const headingHighlight = headingSent ? getHighlightClass(headingSent.sentenceId) : '';

                  const renderHeadingElement = () => {
                    if (level === 3) {
                      return (
                        <h3
                          id={safeHeadingId}
                          data-sentence-id={safeHeadingId}
                          className={`font-serif text-xl sm:text-2xl font-bold text-mirari-ink tracking-tight mt-8 mb-4 pt-2 transition-colors duration-300 ${headingHighlight}`}
                        >
                          {renderInlineContent(headingTitle)}
                        </h3>
                      );
                    }
                    if (level === 4) {
                      return (
                        <h4
                          id={safeHeadingId}
                          data-sentence-id={safeHeadingId}
                          className={`font-serif text-lg sm:text-xl font-bold text-mirari-ink tracking-tight mt-6 mb-3 transition-colors duration-300 ${headingHighlight}`}
                        >
                          {renderInlineContent(headingTitle)}
                        </h4>
                      );
                    }
                    return (
                      <h2
                        id={safeHeadingId}
                        data-sentence-id={safeHeadingId}
                        className={`font-serif text-2xl font-bold text-mirari-ink tracking-tight mt-8 mb-4 transition-colors duration-300 ${headingHighlight}`}
                      >
                        {renderInlineContent(headingTitle)}
                      </h2>
                    );
                  };

                  // Remaining body content after heading line
                  const lines = paraText.split(/\r?\n/);
                  const remainingLines = lines.slice(1).filter((l) => l.trim().length > 0);
                  const hasListInRemaining = remainingLines.some((l) =>
                    l.trim().match(/^([-*+]|\d+\.)\s+/)
                  );

                  // If remaining content contains a list
                  if (hasListInRemaining) {
                    const firstListIndex = remainingLines.findIndex((l) =>
                      l.trim().match(/^([-*+]|\d+\.)\s+/)
                    );
                    const leadInLines =
                      firstListIndex > 0 ? remainingLines.slice(0, firstListIndex) : [];
                    const listLines = parseListItems(remainingLines.slice(firstListIndex));
                    const isOrdered = /^\d+\./.test(listLines[0].trim());

                    return (
                      <div key={pIdx} className="space-y-4">
                        {renderHeadingElement()}
                        {leadInLines.length > 0 && (
                          <p className="leading-relaxed mb-3">
                            {leadInLines.map((line, idx) => {
                              const lineSents = getSentencesForLine(line, matchingSentences);
                              if (lineSents.length > 0) {
                                return lineSents.map((s) => {
                                  const safeId = getSafeSentenceId(s.sentenceId);
                                  const text =
                                    lineSents.length === 1
                                      ? stripMarkdownBlockPrefix(line)
                                      : getSentencePortionForLine(line, s.exactQuote);
                                  return (
                                    <span
                                      key={s.sentenceId}
                                      id={safeId}
                                      className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                                    >
                                      {renderInlineContent(text)}{' '}
                                    </span>
                                  );
                                });
                              }
                              return <React.Fragment key={idx}>{renderInlineContent(line)} </React.Fragment>;
                            })}
                          </p>
                        )}
                        {isOrdered ? (
                          <ol className="my-4 space-y-3 list-decimal list-outside pl-6 text-mirari-ink">
                            {listLines.map((line, lIdx) => {
                              const cleanItem = line.replace(/^\d+\.\s+/, '').trim();
                              const lineSents = getSentencesForLine(line, matchingSentences);
                              return (
                                <li key={lIdx} className="leading-relaxed pl-1">
                                  {lineSents.length > 0 ? (
                                    lineSents.map((s) => {
                                      const safeId = getSafeSentenceId(s.sentenceId);
                                      const text = lineSents.length === 1 ? cleanItem : stripMarkdownBlockPrefix(s.exactQuote);
                                      return (
                                        <span
                                          key={s.sentenceId}
                                          id={safeId}
                                          className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                                        >
                                          {renderInlineContent(text)}{' '}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    renderInlineContent(cleanItem)
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <ul className="my-4 space-y-2.5 list-disc list-outside pl-6 text-mirari-ink">
                            {listLines.map((line, lIdx) => {
                              const cleanItem = line.replace(/^[-*+]\s+/, '').trim();
                              const lineSents = getSentencesForLine(line, matchingSentences);
                              return (
                                <li key={lIdx} className="leading-relaxed pl-1">
                                  {lineSents.length > 0 ? (
                                    lineSents.map((s) => {
                                      const safeId = getSafeSentenceId(s.sentenceId);
                                      const text = lineSents.length === 1 ? cleanItem : stripMarkdownBlockPrefix(s.exactQuote);
                                      return (
                                        <span
                                          key={s.sentenceId}
                                          id={safeId}
                                          className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                                        >
                                          {renderInlineContent(text)}{' '}
                                        </span>
                                      );
                                    })
                                  ) : (
                                    renderInlineContent(cleanItem)
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {/* Safeguard: render any unrendered sentence from matchingSentences */}
                        {matchingSentences
                          .filter((s) => !usedSentenceIds.has(s.sentenceId) && hasTextContent(s.exactQuote))
                          .map((s) => {
                            const safeId = getSafeSentenceId(s.sentenceId);
                            return (
                              <p key={s.sentenceId} className="leading-relaxed">
                                <span
                                  id={safeId}
                                  className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                                >
                                  {renderInlineContent(stripMarkdownBlockPrefix(s.exactQuote))}{' '}
                                </span>
                              </p>
                            );
                          })}
                      </div>
                    );
                  }

                  // Standard paragraph sentences following the heading
                  return (
                    <div key={pIdx} className="space-y-4">
                      {renderHeadingElement()}
                      {matchingSentences.length > 0 && (
                        <p className="leading-relaxed">
                          {matchingSentences.map((sent: SentenceEvidence, sIdx: number) => {
                            let textToRender = sent.exactQuote;
                            // Strip heading prefix from the first sentence so it is not duplicated
                            if (sIdx === 0 && textToRender.startsWith('#')) {
                              textToRender = textToRender.replace(/^(#{1,6})\s+[^\r\n]*\r?\n?/, '').trim();
                            }
                            if (!textToRender || textToRender === '**') return null;

                            // If next sentence is '**', append it to close bold
                            const nextSent = matchingSentences[sIdx + 1];
                            if (nextSent && nextSent.exactQuote.trim() === '**') {
                              textToRender += '**';
                            }

                            const safeId = getSafeSentenceId(sent.sentenceId);
                            return (
                              <span
                                key={sent.sentenceId}
                                id={safeId}
                                className={`transition-colors duration-300 ${getHighlightClass(sent.sentenceId)}`}
                              >
                                {renderInlineContent(textToRender)}{' '}
                              </span>
                            );
                          })}
                        </p>
                      )}
                    </div>
                  );
                }
              }

              // 7. Lists (Ordered or Unordered List Block)
              const hasList = rawLines.some((l) => l.match(/^([-*+]|\d+\.)\s+/));
              if (hasList) {
                const firstListIdx = rawLines.findIndex((l) => l.match(/^([-*+]|\d+\.)\s+/));
                const leadInLines = firstListIdx > 0 ? rawLines.slice(0, firstListIdx) : [];
                const listLines = parseListItems(rawLines.slice(firstListIdx));
                const isOrdered = /^\d+\./.test(listLines[0]);

                return (
                  <div key={pIdx} className="my-4 space-y-3">
                    {/* Optional lead-in text before the list */}
                    {leadInLines.length > 0 && (
                      <p className="leading-relaxed mb-3">
                        {leadInLines.map((line, idx) => {
                          const lineSents = getSentencesForLine(line, matchingSentences);
                          if (lineSents.length > 0) {
                            return lineSents.map((s) => {
                              const safeId = getSafeSentenceId(s.sentenceId);
                              const text =
                                lineSents.length === 1
                                  ? stripMarkdownBlockPrefix(line)
                                  : getSentencePortionForLine(line, s.exactQuote);
                              return (
                                <span
                                  key={s.sentenceId}
                                  id={safeId}
                                  className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                                >
                                  {renderInlineContent(text)}{' '}
                                </span>
                              );
                            });
                          }
                          return <React.Fragment key={idx}>{renderInlineContent(line)} </React.Fragment>;
                        })}
                      </p>
                    )}

                    {/* The list items */}
                    {isOrdered ? (
                      <ol className="my-4 space-y-3 list-decimal list-outside pl-6 text-mirari-ink">
                        {listLines.map((line, lIdx) => {
                          const cleanItem = line.replace(/^\d+\.\s+/, '').trim();
                          const lineSents = getSentencesForLine(line, matchingSentences);
                          return (
                            <li key={lIdx} className="leading-relaxed pl-1">
                              {lineSents.length > 0 ? (
                                lineSents.map((s) => {
                                  const safeId = getSafeSentenceId(s.sentenceId);
                                  const text = lineSents.length === 1 ? cleanItem : stripMarkdownBlockPrefix(s.exactQuote);
                                  return (
                                    <span
                                      key={s.sentenceId}
                                      id={safeId}
                                      className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                                    >
                                      {renderInlineContent(text)}{' '}
                                    </span>
                                  );
                                })
                              ) : (
                                renderInlineContent(cleanItem)
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    ) : (
                      <ul className="my-4 space-y-2.5 list-disc list-outside pl-6 text-mirari-ink">
                        {listLines.map((line, lIdx) => {
                          const cleanItem = line.replace(/^[-*+]\s+/, '').trim();
                          const lineSents = getSentencesForLine(line, matchingSentences);
                          return (
                            <li key={lIdx} className="leading-relaxed pl-1">
                              {lineSents.length > 0 ? (
                                lineSents.map((s) => {
                                  const safeId = getSafeSentenceId(s.sentenceId);
                                  const text = lineSents.length === 1 ? cleanItem : stripMarkdownBlockPrefix(s.exactQuote);
                                  return (
                                    <span
                                      key={s.sentenceId}
                                      id={safeId}
                                      className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                                    >
                                      {renderInlineContent(text)}{' '}
                                    </span>
                                  );
                                })
                              ) : (
                                renderInlineContent(cleanItem)
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Safeguard: render any unrendered sentence from matchingSentences */}
                    {matchingSentences
                      .filter((s) => !usedSentenceIds.has(s.sentenceId) && hasTextContent(s.exactQuote))
                      .map((s) => {
                        const safeId = getSafeSentenceId(s.sentenceId);
                        return (
                          <p key={s.sentenceId} className="leading-relaxed">
                            <span
                              id={safeId}
                              className={`transition-colors duration-300 ${getHighlightClass(s.sentenceId)}`}
                            >
                              {renderInlineContent(stripMarkdownBlockPrefix(s.exactQuote))}{' '}
                            </span>
                          </p>
                        );
                      })}
                  </div>
                );
              }

              // 8. Standard Paragraph with Canonical Sentence Evidence Highlights
              if (matchingSentences.length > 0) {
                return (
                  <p key={pIdx} className="leading-relaxed">
                    {matchingSentences.map((sent: SentenceEvidence, sIdx: number) => {
                      let text = sent.exactQuote;
                      if (text.trim() === '**') return null;

                      // If next sentence is '**', append it to close bold
                      const nextSent = matchingSentences[sIdx + 1];
                      if (nextSent && nextSent.exactQuote.trim() === '**') {
                        text += '**';
                      }

                      const safeId = getSafeSentenceId(sent.sentenceId);
                      return (
                        <span
                          key={sent.sentenceId}
                          id={safeId}
                          className={`transition-colors duration-300 ${getHighlightClass(sent.sentenceId)}`}
                        >
                          {renderInlineContent(text)}{' '}
                        </span>
                      );
                    })}
                  </p>
                );
              }

              // 9. Fallback Paragraph
              return (
                <p key={pIdx} className="leading-relaxed">
                  {renderInlineContent(paraText)}
                </p>
              );
            })}
          </section>
        ))}

      {/* ─── References & Scientific Sources (從文章資料自動渲染) ──── */}
      {document.references && document.references.length > 0 && (
        <section className="pt-8 mt-12 border-t border-mirari-line space-y-3">
          <div className="text-xs font-sans text-mirari-dim font-semibold uppercase tracking-wider">
            參考文獻
          </div>

          <ol className="list-decimal list-inside space-y-2 text-xs text-mirari-muted font-mono leading-relaxed">
            {document.references.map((ref) => (
              <li key={ref.id || ref.citation}>
                {ref.citation}
                {ref.doi && (
                  <span className="ml-1 text-mirari-cobalt">
                    DOI: {ref.doi}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
};
