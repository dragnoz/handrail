import { useEffect, useState } from 'preact/hooks';

const listeners = new Set<(text: string) => void>();

/** A quiet line at the bottom: "Copied". Read out by screen readers, gone in two seconds. */
export function toast(text: string): void {
  for (const l of listeners) l(text);
}

export function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const l = (t: string) => {
      setMsg(t);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(''), 1800);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div class={msg ? 'toast show' : 'toast'} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
