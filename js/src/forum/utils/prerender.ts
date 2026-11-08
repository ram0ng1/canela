/*
 * O conteúdo do servidor visível antes do JS (views/prerender): sai de cena
 * logo antes de o Flarum montar a página, no mesmo quadro em que a página do
 * JS aparece. Fica no DOM (escondido) porque o tratamento de erro do boot lê
 * o texto dele.
 */
import app from 'flarum/forum/app';

export default function installPrerender(): void {
  app.beforeMount(() => {
    const content = document.getElementById('flarum-content');

    if (content?.classList.contains('CanelaPrerender')) content.hidden = true;
  });
}
