import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
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
  view(): Mithril.Children {
    const { group, size = 'normal' } = this.attrs;
    const color = group.color();
    const icon = group.icon();

    return (
      <span
        className={`CanelaGroupFlair CanelaGroupFlair--${size}${color ? ' CanelaGroupFlair--colored' : ''}`}
        style={color ? { '--group-color': color } : undefined}
        aria-hidden="true"
      >
        {icon ? <Icon name={icon} /> : <span className="CanelaGroupFlair-initial">{(group.namePlural() || '?').charAt(0).toUpperCase()}</span>}
      </span>
    );
  }
}
