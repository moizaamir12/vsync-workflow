import { type ReactNode, Fragment } from "react";
import { cn } from "../../lib/utils.js";

/* ── Inline parsing ─────────────────────────────────────── */

/**
 * Parse inline markdown tokens (bold, italic, inline code)
 * into React elements. No dangerouslySetInnerHTML.
 */
function parseInline(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  /* Combined pattern: code > bold > italic (order matters to avoid conflicts) */
  const pattern = /`([^`]+)`|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    /* Push plain text before this match */
    if (match.index > lastIndex) {
      result.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }

    if (match[1] !== undefined) {
      /* Inline code */
      result.push(
        <code
          key={key++}
          className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 text-xs font-mono"
        >
          {match[1]}
        </code>,
      );
    } else if (match[2] !== undefined) {
      /* Bold */
      result.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      /* Italic */
      result.push(<em key={key++}>{match[3]}</em>);
    }

    lastIndex = match.index + match[0].length;
  }

  /* Remaining plain text */
  if (lastIndex < text.length) {
    result.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }

  return result.length > 0 ? result : [<Fragment key={0}>{text}</Fragment>];
}

/* ── Block-level parsing ────────────────────────────────── */

interface ParsedBlock {
  type: "code" | "heading" | "ul" | "ol" | "paragraph";
  content: string;
  language?: string;
  items?: string[];
}

function parseBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    /* Code fence */
    if (line !== undefined && line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== undefined && !lines[i].startsWith("```")) {
        codeLines.push(lines[i] as string);
        i++;
      }
      blocks.push({ type: "code", content: codeLines.join("\n"), language });
      i++; /* skip closing ``` */
      continue;
    }

    /* Heading */
    if (line !== undefined && /^#{1,3}\s/.test(line)) {
      blocks.push({ type: "heading", content: line.replace(/^#{1,3}\s+/, "") });
      i++;
      continue;
    }

    /* Unordered list */
    if (line !== undefined && /^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && lines[i] !== undefined && /^[-*]\s/.test(lines[i] as string)) {
        items.push((lines[i] as string).replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", content: "", items });
      continue;
    }

    /* Ordered list */
    if (line !== undefined && /^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && lines[i] !== undefined && /^\d+\.\s/.test(lines[i] as string)) {
        items.push((lines[i] as string).replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", content: "", items });
      continue;
    }

    /* Empty line — skip */
    if (line !== undefined && line.trim() === "") {
      i++;
      continue;
    }

    /* Paragraph — collect consecutive non-special lines */
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i] !== undefined &&
      (lines[i] as string).trim() !== "" &&
      !(lines[i] as string).startsWith("```") &&
      !/^#{1,3}\s/.test(lines[i] as string) &&
      !/^[-*]\s/.test(lines[i] as string) &&
      !/^\d+\.\s/.test(lines[i] as string)
    ) {
      paraLines.push(lines[i] as string);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  return blocks;
}

/* ── Component ──────────────────────────────────────────── */

export interface AiMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for AI assistant messages.
 * Handles code blocks, headings, lists, bold, italic, inline code.
 * Zero external dependencies.
 */
export function AiMarkdown({ content, className }: AiMarkdownProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case "code":
            return (
              <pre
                key={idx}
                className="overflow-x-auto rounded-md bg-[hsl(var(--muted))] p-3 text-xs font-mono leading-relaxed"
              >
                <code>{block.content}</code>
              </pre>
            );

          case "heading":
            return (
              <p key={idx} className="font-semibold text-sm text-[hsl(var(--foreground))]">
                {parseInline(block.content)}
              </p>
            );

          case "ul":
            return (
              <ul key={idx} className="list-disc space-y-0.5 pl-4 text-sm">
                {block.items?.map((item, j) => (
                  <li key={j}>{parseInline(item)}</li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={idx} className="list-decimal space-y-0.5 pl-4 text-sm">
                {block.items?.map((item, j) => (
                  <li key={j}>{parseInline(item)}</li>
                ))}
              </ol>
            );

          case "paragraph":
            return (
              <p key={idx} className="text-sm leading-relaxed">
                {parseInline(block.content)}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
