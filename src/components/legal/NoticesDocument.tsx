import Link from "next/link";
import type { ReactNode } from "react";

function inlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-medium text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (link) {
        parts.push(
          <Link
            key={key++}
            href={link[2]!}
            className="text-primary underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {link[1]}
          </Link>,
        );
      }
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul" | "ol"; items: string[] };

function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trimEnd();
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3) });
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2) });
      i++;
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i]!.trimEnd())) {
        items.push(lines[i]!.trimEnd().replace(/^[-*] /, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]!.trimEnd())) {
        items.push(lines[i]!.trimEnd().replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    const para: string[] = [line];
    i++;
    while (i < lines.length && lines[i]!.trim() && !/^#{1,3} /.test(lines[i]!) && !/^[-*] /.test(lines[i]!) && !/^\d+\. /.test(lines[i]!)) {
      para.push(lines[i]!.trimEnd());
      i++;
    }
    blocks.push({ type: "p", text: para.join(" ") });
  }
  return blocks;
}

export function NoticesDocument({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown);
  return (
    <article className="space-y-6 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((block, idx) => {
        if (block.type === "h1") {
          return (
            <h2 key={idx} className="font-heading text-2xl font-semibold text-foreground">
              {inlineMarkdown(block.text)}
            </h2>
          );
        }
        if (block.type === "h2") {
          return (
            <h3 key={idx} className="font-heading mt-8 text-xl font-semibold text-foreground">
              {inlineMarkdown(block.text)}
            </h3>
          );
        }
        if (block.type === "h3") {
          return (
            <h4 key={idx} className="mt-4 text-base font-semibold text-foreground">
              {inlineMarkdown(block.text)}
            </h4>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={idx} className="list-disc space-y-2 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{inlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={idx} className="list-decimal space-y-2 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{inlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "p") {
          return <p key={idx}>{inlineMarkdown(block.text)}</p>;
        }
        return null;
      })}
    </article>
  );
}
