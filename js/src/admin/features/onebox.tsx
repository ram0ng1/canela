/*
 * A aba "Onebox" (extend/onebox.php): os links que viram cartões nas
 * postagens. Por enquanto o GitHub (arquivo com as linhas, issue, pull
 * request, commit, release e repositório), com o token opcional da API, e um campo
 * para testar um link e ver o cartão como ele sai no fórum.
 */
import Button from 'flarum/common/components/Button';
import type Mithril from 'mithril';

import { AdminNotice } from '../components/AdminCard';
import { AdminComponent, trans } from '../util';
import type { CardDef } from '../types';
import { AiText } from './ai';
import { fetchOnebox, renderOneboxCard } from '../../common/onebox';

const KEY = 'ramon-canela.admin.settings.onebox';

/** Cola um link, pede o cartão ao servidor e o desenha como no fórum. */
class OneboxTester extends AdminComponent {
  url = '';
  loading = false;
  /** null: nada pedido ainda; false: o link não virou cartão. */
  result: HTMLElement | false | null = null;

  view() {
    return (
      <div className="CanelaOneboxTester">
        <form
          className="CanelaOneboxTester-form"
          onsubmit={(event: Event) => {
            event.preventDefault();
            this.test();
          }}
        >
          <input
            className="FormControl"
            type="url"
            spellcheck={false}
            placeholder={trans(`${KEY}.test_placeholder`)}
            value={this.url}
            oninput={(event: InputEvent) => (this.url = (event.target as HTMLInputElement).value)}
          />
          <Button className="Button Button--primary" type="submit" loading={this.loading} disabled={!this.url.trim()}>
            {trans(`${KEY}.test_button`)}
          </Button>
        </form>
        {this.result === false && <AdminNotice icon="fas fa-circle-info">{trans(`${KEY}.test_none`)}</AdminNotice>}
        <div
          className="CanelaOneboxTester-preview"
          oncreate={(vnode: Mithril.VnodeDOM) => this.paint(vnode.dom as HTMLElement)}
          onupdate={(vnode: Mithril.VnodeDOM) => this.paint(vnode.dom as HTMLElement)}
        />
      </div>
    );
  }

  /** O cartão é um elemento pronto (o mesmo do fórum): entra direto no DOM. */
  paint(container: HTMLElement): void {
    const card = this.result || null;

    if (container.firstElementChild === card) return;

    container.replaceChildren(...(card ? [card] : []));
  }

  test(): void {
    const url = this.url.trim();

    if (!url) return;

    this.loading = true;

    fetchOnebox(url, true).then((card) => {
      this.loading = false;
      this.result = card ? renderOneboxCard(card) : false;
      m.redraw();
    });
  }
}

const cards: CardDef[] = [
  {
    id: 'onebox-github',
    group: 'onebox',
    icon: 'fab fa-github',
    title: () => trans(`${KEY}.github_title`),
    description: () => trans(`${KEY}.github_description`),
    keywords:
      'onebox github cartão card prévia preview link arquivo file código code linhas lines issue pull request pr commit repositório repository token api discourse',
    master: 'canela.onebox_github',
    body: () => (
      <>
        <AdminNotice icon="fas fa-circle-info">{trans(`${KEY}.formats`)}</AdminNotice>
        <AiText
          settingKey="canela.onebox_github_token"
          secret
          label={trans(`${KEY}.token_label`)}
          help={trans(`${KEY}.token_help`)}
          placeholder="github_pat_…"
          savedText={trans(`${KEY}.token_saved`)}
          clearText={trans(`${KEY}.token_clear`)}
        />
      </>
    ),
  },
  {
    id: 'onebox-test',
    group: 'onebox',
    icon: 'fas fa-vial',
    title: () => trans(`${KEY}.test_title`),
    description: () => trans(`${KEY}.test_description`),
    keywords: 'onebox testar test prévia preview link github cartão card',
    dependsOn: 'canela.onebox_github',
    body: () => <OneboxTester />,
  },
];

export default cards;
