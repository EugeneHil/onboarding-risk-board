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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Задача для Битрикс24"
        onClick={(e) => e.stopPropagation()}
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
