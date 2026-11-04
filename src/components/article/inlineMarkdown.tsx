import React from 'react';
import katex from 'katex';

/**
 * Safely render LaTeX using KaTeX
 */
export function renderMathToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
      strict: false,
    });
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

/**
 * Security: Validate that a URL uses safe protocols (http, https, mailto, relative, or anchor)
 * Blocks javascript:, data:, vbscript:, etc.
 */
function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  return /^(https?:\/\/|\/|#|mailto:)/i.test(trimmed);
}

type InlineTokenType =
  | 'text'
  | 'math'
  | 'bold'
  | 'italic'
  | 'bold-italic'
  | 'code'
  | 'link';

interface InlineToken {
  type: InlineTokenType;
  content: string;
  url?: string;
  isExternal?: boolean;
}

/**
 * Robust inline tokenizer for LaTeX ($...$), Bold (**...**), Italic (*...*), Code (`...`), and Links ([...](...))
 * Preserves escaped dollar signs and never breaks on unmatched symbols.
 */
function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let currentText = '';

  const flushText = () => {
    if (currentText) {
      tokens.push({ type: 'text', content: currentText });
      currentText = '';
    }
  };

  while (i < text.length) {
    // 1. Escaped characters: \$ \* \_ \` \[ \] \( \) \#
    if (text[i] === '\\' && i + 1 < text.length) {
      const next = text[i + 1];
      if (['$', '*', '_', '`', '[', ']', '(', ')', '<', '>', '#', '\\'].includes(next)) {
        currentText += next;
        i += 2;
        continue;
      }
    }

    // 2. Inline math: $...$
    if (text[i] === '$') {
      const nextDollar = text.indexOf('$', i + 1);
      if (nextDollar !== -1 && text.slice(i + 1, nextDollar).trim().length > 0) {
        flushText();
        const mathExpr = text.slice(i + 1, nextDollar);
        tokens.push({ type: 'math', content: mathExpr });
        i = nextDollar + 1;
        continue;
      }
    }

    // 3. Inline code: `...`
    if (text[i] === '`') {
      const nextBacktick = text.indexOf('`', i + 1);
      if (nextBacktick !== -1) {
        flushText();
        const codeExpr = text.slice(i + 1, nextBacktick);
        tokens.push({ type: 'code', content: codeExpr });
        i = nextBacktick + 1;
        continue;
      }
    }

    // 4. Markdown link: [label](url) with balanced parenthesis tracking
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        let parenDepth = 1;
        let closeParen = -1;
        for (let p = closeBracket + 2; p < text.length; p++) {
          if (text[p] === '(') parenDepth++;
          else if (text[p] === ')') {
            parenDepth--;
            if (parenDepth === 0) {
              closeParen = p;
              break;
            }
          }
        }
        if (closeParen !== -1) {
          const label = text.slice(i + 1, closeBracket);
          const rawUrl = text.slice(closeBracket + 2, closeParen).trim();
          const safe = isSafeUrl(rawUrl);
          flushText();
          tokens.push({
            type: 'link',
            content: label,
            url: safe ? rawUrl : '#',
            isExternal: /^https?:\/\//i.test(rawUrl),
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // 5. Bold-Italic: ***...*** or ___...___
    if (
      (text.startsWith('***', i) && text.indexOf('***', i + 3) !== -1) ||
      (text.startsWith('___', i) && text.indexOf('___', i + 3) !== -1)
    ) {
      const delim = text.slice(i, i + 3);
      const nextDelim = text.indexOf(delim, i + 3);
      flushText();
      const expr = text.slice(i + 3, nextDelim);
      tokens.push({ type: 'bold-italic', content: expr });
      i = nextDelim + 3;
      continue;
    }

    // 6. Bold: **...** or __...__
    if (
      (text.startsWith('**', i) && text.indexOf('**', i + 2) !== -1) ||
      (text.startsWith('__', i) && text.indexOf('__', i + 2) !== -1)
    ) {
      const delim = text.slice(i, i + 2);
      const nextDelim = text.indexOf(delim, i + 2);
      flushText();
      const expr = text.slice(i + 2, nextDelim);
      tokens.push({ type: 'bold', content: expr });
      i = nextDelim + 2;
      continue;
    }

    // 7. Italic: *...* or _..._
    if (text[i] === '*' || (text[i] === '_' && (i === 0 || /\s/.test(text[i - 1])))) {
      const delim = text[i];
      const nextDelim = text.indexOf(delim, i + 1);
      if (nextDelim !== -1 && nextDelim > i + 1 && text.slice(i + 1, nextDelim).trim().length > 0) {
        flushText();
        const expr = text.slice(i + 1, nextDelim);
        tokens.push({ type: 'italic', content: expr });
        i = nextDelim + 1;
        continue;
      }
    }

    currentText += text[i];
    i++;
  }

  flushText();
  return tokens;
}

/**
 * Render parsed inline tokens into React nodes
 */
export function renderInlineContent(text: string): React.ReactNode {
  if (!text) return null;
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
      case 'bold-italic':
        return (
          <strong key={idx} className="font-semibold text-mirari-ink">
            <em className="italic">{renderInlineContent(tok.content)}</em>
          </strong>
        );
      case 'bold':
        return (
          <strong key={idx} className="font-semibold text-mirari-ink">
            {renderInlineContent(tok.content)}
          </strong>
        );
      case 'italic':
        return (
          <em key={idx} className="italic text-mirari-ink">
            {renderInlineContent(tok.content)}
          </em>
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
      case 'link':
        return (
          <a
            key={idx}
            href={tok.url}
            target={tok.isExternal ? '_blank' : undefined}
            rel={tok.isExternal ? 'noopener noreferrer' : undefined}
            className="text-mirari-cobalt underline underline-offset-2 hover:text-mirari-ink transition-colors"
          >
            {renderInlineContent(tok.content)}
          </a>
        );
      case 'text':
      default:
        return <React.Fragment key={idx}>{tok.content}</React.Fragment>;
    }
  });
}
