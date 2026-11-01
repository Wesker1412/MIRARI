import React from 'react';
import katex from 'katex';
import type { ArticleDocument, ArticleSection, SentenceEvidence } from '../../types';
import { getInteractiveComponent } from '../interactive/registry';

interface ArticleRendererProps {
  document: ArticleDocument;
  getHighlightClass: (sentenceId: string) => string;
}

/**
 * Safely render LaTeX using KaTeX
 */
function renderMathToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return latex;
  }
}

interface InlineToken {
  type: 'text' | 'math' | 'bold' | 'code';
  content: string;
}

/**
 * Robust inline tokenizer for LaTeX ($...$), Bold (**...**), and Code (`...`)
 * Preserves escaped dollar signs and never breaks on unmatched symbols.
 */
function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let currentText = '';

  while (i < text.length) {
    // Escaped dollar: \$
    if (text[i] === '\\' && text[i + 1] === '$') {
      currentText += '$';
      i += 2;
      continue;
    }

    // Inline math: $...$
    if (text[i] === '$') {
      const nextDollar = text.indexOf('$', i + 1);
      if (nextDollar !== -1) {
        if (currentText) {
          tokens.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const mathExpr = text.slice(i + 1, nextDollar);
        tokens.push({ type: 'math', content: mathExpr });
        i = nextDollar + 1;
        continue;
      }
    }

    // Bold: **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const nextStars = text.indexOf('**', i + 2);
      if (nextStars !== -1) {
        if (currentText) {
          tokens.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const boldExpr = text.slice(i + 2, nextStars);
        tokens.push({ type: 'bold', content: boldExpr });
        i = nextStars + 2;
        continue;
      }
    }

    // Code: `...`
    if (text[i] === '`') {
      const nextBacktick = text.indexOf('`', i + 1);
      if (nextBacktick !== -1) {
        if (currentText) {
          tokens.push({ type: 'text', content: currentText });
          currentText = '';
        }
        const codeExpr = text.slice(i + 1, nextBacktick);
        tokens.push({ type: 'code', content: codeExpr });
        i = nextBacktick + 1;
        continue;
      }
    }

    currentText += text[i];
    i++;
  }

  if (currentText) {
    tokens.push({ type: 'text', content: currentText });
  }

  return tokens;
}

/**
 * Render parsed inline tokens into React nodes
 */
function renderInlineContent(text: string): React.ReactNode {
  const tokens = parseInlineTokens(text);
  return tokens.map((tok, idx) => {
    switch (tok.type) {
      case 'math':
        return (
          <span
            key={idx}
            className="inline-math px-0.5 align-baseline"
            dangerouslySetInnerHTML={{ __html: renderMathToHtml(tok.content, false) }}
          />
        );
      case 'bold':
        return (
          <strong key={idx} className="font-semibold text-mirari-ink">
            {renderInlineContent(tok.content)}
          </strong>
        );
      case 'code':
        return (
          <code
            key={idx}
            className="font-mono text-xs px-1.5 py-0.5 bg-mirari-paper border border-mirari-line rounded text-mirari-ink"
          >
            {tok.content}
          </code>
        );
      case 'text':
      default:
        return <React.Fragment key={idx}>{tok.content}</React.Fragment>;
    }
  });
}

export const ArticleRenderer: React.FC<ArticleRendererProps> = ({
  document,
  getHighlightClass,
}) => {
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
      {document.sections && document.sections.map((section: ArticleSection) => (
        <section key={section.id} id={section.id} className="space-y-5 pt-2">
          {/* Section Heading */}
          <h2 className="font-serif text-2xl font-bold text-mirari-ink tracking-tight pt-2">
            {section.title}
          </h2>

          {/* Section Paragraphs & Sentences */}
          {section.paragraphs.map((paraText, pIdx) => {
            // Check if paragraph is an embedded interactive component
            if (paraText.includes('<InteractiveExperiment')) {
              const match = paraText.match(/id=["']([^"']+)["']/);
              const compId = match
                ? match[1]
                : section.interactiveComponentId || document.interactiveComponent || 'TransitSimulator';
              const compMeta = getInteractiveComponent(compId);
              if (compMeta) {
                const Component = compMeta.component;
                return (
                  <div key={pIdx} className="my-6 space-y-3">
                    <Component />
                  </div>
                );
              }
            }

            // Check if paragraph is a standalone display math block: $$...$$ or \[...\]
            const isDisplayMath =
              (paraText.startsWith('$$') && paraText.endsWith('$$')) ||
              (paraText.startsWith('\\[') && paraText.endsWith('\\]'));

            if (isDisplayMath) {
              const formula = paraText.startsWith('$$')
                ? paraText.slice(2, -2).trim()
                : paraText.slice(2, -2).trim();
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

            // Regular paragraph: Render sentences automatically with exact IDs
            const matchingSentences = (section.sentences || []).filter(
              (s: SentenceEvidence) => s.paragraphIndex === pIdx
            );

            if (matchingSentences.length > 0) {
              return (
                <p key={pIdx} className="leading-relaxed">
                  {matchingSentences.map((sent: SentenceEvidence) => (
                    <span
                      key={sent.sentenceId}
                      id={sent.sentenceId}
                      className={`transition-colors duration-300 ${getHighlightClass(sent.sentenceId)}`}
                    >
                      {renderInlineContent(sent.exactQuote)}{' '}
                    </span>
                  ))}
                </p>
              );
            }

            // Fallback paragraph
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
