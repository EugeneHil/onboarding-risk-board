/** UTF-8 when valid, otherwise windows-1251 (what Russian Excel writes for "CSV (разделители — точка с запятой)"). */
export function decodeText(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1251').decode(bytes);
  }
}
