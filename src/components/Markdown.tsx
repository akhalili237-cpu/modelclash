import React, { useMemo, useState } from 'react';
import { CopyBtn } from './ui';

/* Lightweight, dependency-free markdown renderer (safe React nodes). */

function Inline({ text }: { text: string }): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(~~[^~\n]+~~)|(\[[^\]\n]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      out.push(<code key={k++} className="rounded bg-panel2 border border-line px-1.5 py-0.5 text-[.85em] text-orange-300">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith('**')) {
      out.push(<strong key={k++} className="font-bold text-white">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('~~')) {
      out.push(<del key={k++} className="opacity-60">{tok.slice(2, -2)}</del>);
    } else if (tok.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(tok)!;
      out.push(
        <a key={k++} href={mm[2]} target="_blank" rel="noopener noreferrer" className="text-orange-300 underline underline-offset-2 hover:text-orange-200">
          {mm[1]}
        </a>,
      );
    } else {
      out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-line bg-[#0b0b12]">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{lang || 'code'}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed" dir="ltr">
        <code className="font-mono text-zinc-200">{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks = useMemo(() => text.split(/```/), [text]);

  const renderTextBlock = (raw: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    const lines = raw.split('\n');
    let i = 0;
    let key = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) { i++; continue; }

      // heading
      const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
      if (h) {
        const lvl = h[1].length;
        const cls = ['text-xl font-extrabold mt-4 mb-2', 'text-lg font-bold mt-4 mb-2', 'text-base font-bold mt-3 mb-1.5', 'text-sm font-bold mt-3 mb-1'][lvl - 1];
        nodes.push(<div key={key++} className={`text-white ${cls}`}><Inline text={h[2]} /></div>);
        i++;
        continue;
      }

      // hr
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        nodes.push(<hr key={key++} className="my-4 border-line" />);
        i++;
        continue;
      }

      // blockquote
      if (trimmed.startsWith('>')) {
        const buf: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) {
          buf.push(lines[i].trim().replace(/^>\s?/, ''));
          i++;
        }
        nodes.push(
          <blockquote key={key++} className="my-3 border-s-2 border-accent/50 ps-3 text-zinc-400 italic">
            <Inline text={buf.join(' ')} />
          </blockquote>,
        );
        continue;
      }

      // unordered list
      if (/^[-*•]\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^[-*•]\s+/, ''));
          i++;
        }
        nodes.push(
          <ul key={key++} className="my-2 list-disc space-y-1 ps-5">
            {items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
          </ul>,
        );
        continue;
      }

      // ordered list
      if (/^\d+[.)]\s+/.test(trimmed)) {
        const items: string[] = [];
        while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
          items.push(lines[i].trim().replace(/^\d+[.)]\s+/, ''));
          i++;
        }
        nodes.push(
          <ol key={key++} className="my-2 list-decimal space-y-1 ps-5">
            {items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
          </ol>,
        );
        continue;
      }

      // paragraph — consume until blank line / structural marker
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,4})\s|^[-*•]\s|^\d+[.)]\s|^>|^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
      ) {
        para.push(lines[i]);
        i++;
      }
      nodes.push(
        <p key={key++} className="my-2 leading-relaxed whitespace-pre-wrap break-words">
          <Inline text={para.join('\n')} />
        </p>,
      );
    }
    return nodes;
  };

  return (
    <div className="text-[15px] text-zinc-200">
      {blocks.map((block, bi) => {
        // even index = text, odd = code (if text started with ```)
        if (bi % 2 === 1) {
          const nl = block.indexOf('\n');
          const lang = nl > 0 ? block.slice(0, nl).trim() : '';
          const code = nl >= 0 ? block.slice(nl + 1) : block;
          const codeClean = code.replace(/\n$/, '');
          return <CodeBlock key={bi} code={codeClean} lang={lang} />;
        }
        return <React.Fragment key={bi}>{renderTextBlock(block)}</React.Fragment>;
      })}
    </div>
  );
}
