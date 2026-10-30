import { useMemo } from 'preact/hooks';
import { renderMarkdown } from './render';

interface Props {
  md: string;
  /** Called with the link's address instead of letting the browser follow it. */
  onLink: (href: string) => void;
  class?: string;
}

/** A step's body or a guide's intro. Links open in the current tab, through onLink. */
export function Markdown({ md, onLink, class: cls }: Props) {
  const html = useMemo(() => renderMarkdown(md), [md]);
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    onLink(a.href);
  };
  return <div class={cls ? `md ${cls}` : 'md'} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}
