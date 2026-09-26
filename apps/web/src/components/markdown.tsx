import { lexer, type Token, type Tokens } from 'marked';
import { useMemo, type CSSProperties, type ReactNode } from 'react';

/**
 * 用 marked 做解析、自己把 token 渲染成 React 元素。
 * 好处是渲染结果不经过 HTML 字符串，React 会自动转义文本，
 * 因此即使正文里写了 <script> 也不会被执行，无需再引入 DOMPurify。
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** 只放行常规协议，挡掉 javascript: 这类可执行地址。 */
function safeHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith('#')) return value;
  try {
    const parsed = new URL(value, 'https://bupt3dao.club');
    return SAFE_PROTOCOLS.has(parsed.protocol) ? value : null;
  } catch {
    return null;
  }
}

function alignStyle(align: Tokens.TableCell['align']): CSSProperties | undefined {
  return align ? { textAlign: align } : undefined;
}

function inlineNodes(tokens: Token[] | undefined, keyPrefix: string): ReactNode[] {
  if (!tokens) return [];
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case 'text': {
        const node = token as Tokens.Text;
        return node.tokens ? inlineNodes(node.tokens, key) : node.text;
      }
      case 'strong':
        return <strong key={key}>{inlineNodes((token as Tokens.Strong).tokens, key)}</strong>;
      case 'em':
        return <em key={key}>{inlineNodes((token as Tokens.Em).tokens, key)}</em>;
      case 'del':
        return <del key={key}>{inlineNodes((token as Tokens.Del).tokens, key)}</del>;
      case 'codespan':
        return <code key={key}>{(token as Tokens.Codespan).text}</code>;
      case 'br':
        return <br key={key} />;
      case 'escape':
        return (token as Tokens.Escape).text;
      case 'link': {
        const node = token as Tokens.Link;
        const href = safeHref(node.href);
        const label = inlineNodes(node.tokens, key);
        if (!href) return <span key={key}>{label}</span>;
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {label}
          </a>
        );
      }
      case 'image': {
        const node = token as Tokens.Image;
        const src = safeHref(node.href);
        if (!src) return <span key={key}>{node.text}</span>;
        return (
          // 正文里的图片来自外部站点，走原生 img 即可（不需要 Next 图片优化）
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={key}
            src={src}
            alt={node.text}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        );
      }
      case 'html':
      case 'tag':
        // 不支持内联 HTML，直接忽略，避免把它当作可执行内容渲染
        return null;
      default:
        return (token as Tokens.Generic).raw;
    }
  });
}

function blockNodes(tokens: Token[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case 'space':
      case 'def':
      case 'html':
        return null;
      case 'text': {
        const node = token as Tokens.Text;
        return <p key={key}>{inlineNodes(node.tokens ?? [token], key)}</p>;
      }
      case 'heading': {
        const node = token as Tokens.Heading;
        const depth = Math.min(Math.max(node.depth, 1), 6);
        const Heading = `h${depth}` as 'h1';
        return <Heading key={key}>{inlineNodes(node.tokens, key)}</Heading>;
      }
      case 'paragraph':
        return <p key={key}>{inlineNodes((token as Tokens.Paragraph).tokens, key)}</p>;
      case 'code': {
        const node = token as Tokens.Code;
        return (
          <pre key={key} data-lang={node.lang || undefined}>
            <code>{node.text}</code>
          </pre>
        );
      }
      case 'blockquote':
        return (
          <blockquote key={key}>{blockNodes((token as Tokens.Blockquote).tokens, key)}</blockquote>
        );
      case 'list': {
        const node = token as Tokens.List;
        const List = node.ordered ? 'ol' : 'ul';
        return (
          <List
            key={key}
            start={node.ordered && typeof node.start === 'number' ? node.start : undefined}
          >
            {node.items.map((item, itemIndex) => (
              <li key={`${key}-i${itemIndex}`}>
                {blockNodes(item.tokens, `${key}-i${itemIndex}`)}
              </li>
            ))}
          </List>
        );
      }
      case 'hr':
        return <hr key={key} />;
      case 'table': {
        const node = token as Tokens.Table;
        return (
          <div className="md-table-wrap" key={key}>
            <table>
              <thead>
                <tr>
                  {node.header.map((cell, cellIndex) => (
                    <th key={cellIndex} style={alignStyle(cell.align)}>
                      {inlineNodes(cell.tokens, `${key}-h${cellIndex}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {node.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} style={alignStyle(cell.align)}>
                        {inlineNodes(cell.tokens, `${key}-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return null;
    }
  });
}

interface MarkdownProps {
  source: string;
  className?: string;
}

export function Markdown({ source, className }: MarkdownProps) {
  const nodes = useMemo(() => {
    if (!source.trim()) return null;
    return blockNodes(lexer(source, { gfm: true }), 'md');
  }, [source]);

  if (!nodes) return null;
  return <div className={className ? `markdown ${className}` : 'markdown'}>{nodes}</div>;
}
