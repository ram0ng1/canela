/*
 * Tipos do painel do admin, num arquivo próprio para que os recursos com
 * backend (./features/*) declarem os cards deles sem importar o index.
 */
export type GroupKey =
  'appearance' | 'navigation' | 'list' | 'topic' | 'composer' | 'people' | 'messages' | 'community' | 'moderation' | 'system' | 'integrations' | 'ai';

export interface CardDef {
  /** Identificador estável: âncora do card, chave do Mithril e alvo dos links "depende de". */
  id: string;
  group: GroupKey;
  icon: string;
  title: () => string;
  /** O que o recurso faz, abaixo do título — continua à vista com o recurso desligado. */
  description?: () => string;
  /** Palavras extras para a busca — o que se digitaria procurando o card. */
  keywords: string;
  /**
   * A chave liga/desliga do recurso, desenhada no cabeçalho do card. Desligada,
   * o miolo some inteiro (não fica só apagado) e os cards e opções que
   * dependem dela somem também.
   */
  master?: string;
  /**
   * Chaves que precisam estar ligadas para o card existir — normalmente o
   * `master` de outro card. Sem elas o card some do grupo (e aparece só na
   * nota "Ocultos" do fim, com o link para o que falta ligar).
   */
  dependsOn?: string | string[];
  /**
   * Extensões sem as quais o recurso não funciona (ids do Flarum, como
   * `fof-drafts`). Sem elas o card fica à vista, mas trancado, com
   * "Precisa da extensão X".
   */
  extensions?: string[];
  /** Outro motivo para trancar o card (backend não carregado, provedor sem chave…), ou `null`. */
  lockedBy?: () => string | null;
  /** O miolo; omitido nos cards que são só a chave do cabeçalho. */
  body?: () => any;
}
