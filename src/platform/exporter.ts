/** Save export/import: file download/upload + clipboard. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Native share sheet available (mobile browsers, mostly). */
export function canShare(): boolean {
  return typeof navigator.share === 'function';
}

async function shareData(data: ShareData): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false; // dismissed sheet or refused payload — caller falls back
  }
}

export const shareText = (text: string): Promise<boolean> => shareData({ text });
export const shareUrl = (url: string): Promise<boolean> => shareData({ url });

export function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.corelode,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
