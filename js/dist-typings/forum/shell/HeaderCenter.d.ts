import Component from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';
/**
 * O badge do core cria a dica sem posição (em cima). `tooltipPosition` escolhe
 * outra: no cabeçalho fixo a dica abre para baixo, e não cortada no topo da
 * tela. O atributo sai do elemento do badge (não vai para o DOM).
 */
export declare function installBadgeTooltipPosition(): void;
export declare function watchHeaderTopic(): void;
export default class HeaderCenter extends Component {
    shown: boolean;
    view(): Mithril.Children;
    oncreate(): void;
    onupdate(): void;
    /**
     * A classe no cabeçalho com o título do tópico nele (Header.less,
     * Mobile.less), no lugar de `.App-header:has(.CanelaHeaderTopic)`: o
     * `:has()` fazia o navegador reavaliar o cabeçalho a cada mudança dentro
     * dele. Corre depois do patch e antes da pintura, sem quadro trocado.
     */
    markHeader(): void;
    topic(discussion: Discussion): Mithril.Children;
}
