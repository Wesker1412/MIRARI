import React from 'react';
import type { ArticleDocument, ArticleSection, SentenceEvidence } from '../../types';
import { getInteractiveComponent } from '../interactive/registry';

interface ArticleRendererProps {
  document: ArticleDocument;
  getHighlightClass: (sentenceId: string) => string;
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
            「{document.quoteLead}」
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

            // Check if paragraph is a standalone display math block
            if (paraText.startsWith('$$') && paraText.endsWith('$$')) {
              const formula = paraText.slice(2, -2).trim();
              return (
                <div
                  key={pIdx}
                  className="my-5 py-4 text-center border-y border-mirari-line bg-mirari-paper rounded-xl overflow-x-auto"
                >
                  <div className="font-mono text-lg sm:text-2xl font-bold text-mirari-ink tracking-wider px-4">
                    {formula}
                  </div>
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
                      {sent.exactQuote}{' '}
                    </span>
                  ))}
                </p>
              );
            }

            // Fallback paragraph
            return (
              <p key={pIdx} className="leading-relaxed">
                {paraText}
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
