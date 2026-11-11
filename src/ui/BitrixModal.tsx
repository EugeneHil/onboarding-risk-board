import { useEffect, useRef, useState } from 'react';
import type { BitrixTaskPayload } from '../domain/bitrix';

interface BitrixModalProps {
  payload: BitrixTaskPayload;
  onClose: () => void;
}

export function BitrixModal({ payload, onClose }: BitrixModalProps) {
  const text = JSON.stringify(payload, null, 2);
  const preRef = useRef<HTMLPreElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      // Keep keyboard focus inside the dialog while it is open.
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button') ?? []);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard API unavailable or denied: select the text so Ctrl+C works.
      const pre = preRef.current;
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        pressedOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        // Close only if the press started on the backdrop too (a drag that ends here is not a click-away).
        if (pressedOnBackdrop.current && e.target === e.currentTarget) onClose();
        pressedOnBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Задача для Битрикс24"
      >
        <h2>Задача для Битрикс24</h2>
        <p className="muted">
          Так выглядел бы вызов REST API. В демо он не отправляется: интеграции с Битрикс24 нет, а
          ответственный подставлен условно.
        </p>
        <pre ref={preRef}>{text}</pre>
        <div className="modal-actions">
          <button type="button" onClick={copy}>
            {copied ? 'Скопировано' : 'Скопировать'}
          </button>
          <button type="button" ref={closeRef} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
