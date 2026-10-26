import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';
export interface GroupFlairAttrs extends ComponentAttrs {
    group: Group;
    size?: 'normal' | 'large';
}
/**
 * O "flair" do grupo: um quadrado arredondado na cor do grupo
 * com o ícone dele. Sem ícone, a inicial do nome; sem cor, o cinza do tema.
 */
export default class GroupFlair extends Component<GroupFlairAttrs> {
    view(): Mithril.Children;
}
