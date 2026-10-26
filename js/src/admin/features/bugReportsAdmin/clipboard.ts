/*
 * Copiar para a área de transferência: o texto das instruções da IA e a
 * captura (como PNG, o único formato de imagem que todo navegador aceita
 * colar). Sem a API moderna, o texto cai no velho execCommand.
 */

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);

    return;
  } catch {
    // Sem permissão ou fora de HTTPS: o caminho antigo.
  }

  const area = document.createElement('textarea');

  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();

  const ok = document.execCommand('copy');

  area.remove();

  if (!ok) throw new Error('clipboard');
}

/** Copia a imagem do endereço (WebP do servidor) convertida em PNG. */
export async function copyImage(url: string): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('clipboard');

  const png = fetch(url, { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error('image');

      return res.blob();
    })
    .then((blob) => createImageBitmap(blob))
    .then(
      (bitmap) =>
        new Promise<Blob>((resolve, reject) => {
          const canvas = document.createElement('canvas');

          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('image'))), 'image/png');
        })
    );

  // O Safari exige que o ClipboardItem nasça dentro do clique: a promessa vai dentro dele.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

/** O texto de uma rota da API (as instruções em Markdown). */
export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'text/markdown, text/plain' } });

  if (!res.ok) throw new Error(String(res.status));

  return res.text();
}
