import React from 'react';
import { renderInlineContent } from '../article/inlineMarkdown';

const listItem = /^\s*(?:(\d+)\. |[-*+] )(.+)$/;

export function CompanionMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let start: number | undefined;

  const flushList = () => {
    if (!list.length) return;
    const Tag = start === undefined ? 'ul' : 'ol';
    blocks.push(
      <Tag key={blocks.length} start={start} className={`pl-5 ${Tag === 'ul' ? 'list-disc' : 'list-decimal'}`}>
        {list.map((item, index) => <li key={index}>{renderInlineContent(item)}</li>)}
      </Tag>
    );
    list = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(listItem);
    if (match) {
      const number = match[1] === undefined ? undefined : Number(match[1]);
      if (list.length && (start === undefined) !== (number === undefined)) flushList();
      if (!list.length) start = number;
      list.push(match[2]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    blocks.push(heading
      ? <p key={blocks.length} className="font-semibold">{renderInlineContent(heading[1])}</p>
      : <p key={blocks.length}>{renderInlineContent(line)}</p>);
  }
  flushList();
  return <div className="space-y-1.5 break-words">{blocks}</div>;
}
