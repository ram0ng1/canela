/*
 * Copiar texto para a área de transferência, devolvendo se deu certo. O
 * Clipboard API só existe em contexto seguro; fora dele (http numa rede
 * local) vale o velho execCommand com um campo temporário.
 */
function legacyCopy(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();

  let copied = false;

  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  field.remove();

  return copied;
}

export function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text)
    );
  }

  return Promise.resolve(legacyCopy(text));
}
