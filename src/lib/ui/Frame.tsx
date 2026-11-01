import { openHere } from '../ext';

interface Props {
  url: string;
  title: string;
  onBack: () => void;
}

/** An assistant's own page inside the drawer. Handrail does not read it; it is the page, in a frame. */
export function Frame({ url, title, onBack }: Props) {
  return (
    <div class="frame-view">
      <header class="top">
        <button class="btn btn-quiet" onClick={onBack}>
          ← Guides
        </button>
        <span class="frame-title">{title}</span>
        <button class="btn btn-quiet" onClick={() => void openHere(url)} title="Open it in the tab instead">
          In the tab
        </button>
      </header>
      <iframe class="frame" src={url} title={title} allow="clipboard-write; microphone; camera" />
    </div>
  );
}
