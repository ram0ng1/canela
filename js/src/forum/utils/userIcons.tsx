/*
 * Ícones logo depois do nome de uma pessoa (o selo de verificado do
 * ramon/verified, por exemplo): na linha
 * do texto, do tamanho dele, depois do nome e antes do emoji de status.
 *
 * As telas do tema (cabeçalho do post, post embutido, "em resposta a",
 * cartão, perfil, lista de usuários, menções) chamam `userIcons()` onde o
 * nome termina; as integrações (thirdparty/*) registram o que desenhar. Assim
 * nenhuma tela importa uma extensão que pode estar desligada.
 */
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

/** Onde o nome aparece: muda o tamanho e se cabe um popover. */
export type UserIconContext = 'post' | 'embedded' | 'replyTo' | 'card' | 'profile' | 'directory' | 'mention' | 'menu' | 'list';

type Provider = (user: User, context: UserIconContext) => Mithril.Children;

const providers: { key: string; priority: number; provider: Provider }[] = [];

/** Registra um ícone; prioridade maior vem primeiro, como no ItemList. */
export function registerUserIcon(key: string, provider: Provider, priority = 0): void {
  if (providers.some((entry) => entry.key === key)) return;

  providers.push({ key, priority, provider });
  providers.sort((a, b) => b.priority - a.priority);
}

/**
 * Os ícones da pessoa num <span> só (ou nada): um vnode único não mexe nas
 * listas com key do Mithril de quem chama.
 */
export function userIcons(user: User | null | undefined, context: UserIconContext): Mithril.Children {
  if (!user || !providers.length) return null;

  const icons: Mithril.Children[] = [];

  for (const { provider } of providers) {
    try {
      const icon = provider(user, context);

      if (icon) icons.push(icon);
    } catch {
      // Um ícone com erro (extensão em versão nova, por exemplo) não pode
      // derrubar o post ou o cartão inteiro: só fica de fora.
    }
  }

  return icons.length ? <span className={`CanelaUserIcons CanelaUserIcons--${context}`}>{icons}</span> : null;
}
