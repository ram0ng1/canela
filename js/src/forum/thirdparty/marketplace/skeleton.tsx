/*
 * O carregamento das telas do ramon/marketplace no desenho do tema.
 *
 * Os skeletons da extensão (MpSkeleton) desenham o leiaute do avocado: caixas
 * com borda e blocos cinza do tamanho da página. Aqui cada variante desenha o
 * leiaute que o tema dá à tela pronta (Marketplace*.less), com os mesmos
 * containers e medidas, e os blocos são os `.CanelaSkeleton` do tema (o brilho
 * do Discourse, no claro e no escuro):
 *
 * - vitrine (`cards`): a grade de cartões, com o selo, o nome, o preço e duas
 *   linhas de descrição;
 * - listas (`list`, e os skeletons próprios de pedidos, downloads, assinaturas
 *   e reembolsos): linhas da lista de discussões, com o ícone redondo, duas
 *   linhas curtas e o valor à direita;
 * - produto: a capa larga e as duas colunas (título e texto; a caixa de compra);
 * - carrinho, checkout, pedido e painel do vendedor: as colunas e os blocos
 *   de cada um.
 *
 * As variantes que o tema não redesenha (curso, pacote, vendedor, detalhe)
 * continuam as da extensão.
 */
import { override } from 'flarum/common/extend';
import type Mithril from 'mithril';

import { thirdParty } from '../settings';

const MODULE = 'ext:ramon/marketplace/forum/components/';

/** Um bloco do skeleton do tema, com a largura e a altura do que ele substitui. */
function b(width: string, height: number, extra = ''): Mithril.Children {
  return <span className={`CanelaSkeleton CanelaMpSkel-b ${extra}`.trim()} style={{ width, height: `${height}px` }} />;
}

function repeat(n: number, render: (i: number) => Mithril.Children): Mithril.Children[] {
  return Array.from({ length: n }).map((_, i) => render(i));
}

/** Larguras que variam de linha para linha, para não parecer uma régua. */
const WIDTHS = ['62%', '48%', '70%', '55%', '40%', '66%'];

function cards(n: number): Mithril.Children {
  // Os mesmos containers do cartão pronto (cabeçalho em grade, descrição e
  // rodapé): cada bloco nasce na altura e na posição do conteúdo.
  return (
    <div className="MpShop-grid CanelaMpSkel-grid">
      {repeat(n, (i) => (
        <div key={String(i)} className="MpShop-card CanelaMpSkel-card">
          <div className="MpShop-cardHead">
            <div className="MpShop-cardIcon">{b('44px', 44, 'CanelaMpSkel-tile')}</div>
            <div className="MpShop-cardMain">{b(WIDTHS[i % WIDTHS.length], 20)}</div>
            <div className="MpShop-priceBtn">{b('38%', 22)}</div>
          </div>
          <div className="MpShop-cardDesc">
            {b('100%', 14)}
            {b('92%', 14)}
            {b('64%', 14)}
          </div>
          <div className="MpShop-cardFoot">{b('45%', 14)}</div>
        </div>
      ))}
    </div>
  );
}

function rows(n: number, round = true): Mithril.Children {
  return (
    <div className="CanelaMpSkel-list">
      {repeat(n, (i) => (
        <div key={String(i)} className="CanelaMpSkel-row">
          {b('40px', 40, round ? 'CanelaMpSkel-avatar' : 'CanelaMpSkel-tile')}
          <div className="CanelaMpSkel-lines">
            {b(WIDTHS[i % WIDTHS.length], 18)}
            {b('28%', 13)}
          </div>
          {b('84px', 20, 'CanelaMpSkel-end')}
        </div>
      ))}
    </div>
  );
}

function product(): Mithril.Children {
  return (
    <div className="CanelaMpSkel-product">
      {b('64px', 14)}
      {b('100%', 280, 'CanelaMpSkel-cover')}
      <div className="MpProduct-cols">
        <div className="CanelaMpSkel-lines CanelaMpSkel-main">
          {b('58%', 40)}
          {b('30%', 16)}
          <div className="CanelaMpSkel-tabs">
            {b('96px', 18)}
            {b('110px', 18)}
          </div>
          {repeat(5, (i) => b(i === 4 ? '46%' : '100%', 15))}
        </div>
        <div className="CanelaMpSkel-buy">
          {b('55%', 34)}
          {b('30%', 14)}
          {b('100%', 46, 'CanelaMpSkel-button')}
          {b('100%', 36, 'CanelaMpSkel-button')}
        </div>
      </div>
    </div>
  );
}

function summary(lines: number): Mithril.Children {
  return (
    <div className="CanelaMpSkel-summary">
      {b('50%', 22)}
      {repeat(lines, () => (
        <div className="CanelaMpSkel-pair">
          {b('34%', 14)}
          {b('22%', 14)}
        </div>
      ))}
      {b('100%', 46, 'CanelaMpSkel-button')}
    </div>
  );
}

function cart(n: number): Mithril.Children {
  return (
    <div className="CanelaMpSkel-split">
      <div className="CanelaMpSkel-list">
        {repeat(n, (i) => (
          <div key={String(i)} className="CanelaMpSkel-row">
            {b('64px', 64, 'CanelaMpSkel-tile')}
            <div className="CanelaMpSkel-lines">
              {b(WIDTHS[i % WIDTHS.length], 18)}
              {b('24%', 13)}
            </div>
            {b('104px', 36, 'CanelaMpSkel-button')}
            {b('80px', 20, 'CanelaMpSkel-end')}
          </div>
        ))}
      </div>
      {summary(2)}
    </div>
  );
}

function checkout(): Mithril.Children {
  const field = (width = '100%') => (
    <div className="CanelaMpSkel-field">
      {b('90px', 13)}
      {b(width, 42)}
    </div>
  );

  return (
    <div className="CanelaMpSkel-split">
      <div className="CanelaMpSkel-form">
        {repeat(3, (i) => (
          <div key={String(i)} className="CanelaMpSkel-step">
            {b('160px', 24)}
            {field()}
            {i < 2 && field('70%')}
          </div>
        ))}
      </div>
      {summary(3)}
    </div>
  );
}

function order(n: number): Mithril.Children {
  return (
    <div className="CanelaMpSkel-order">
      {b('64px', 14)}
      <div className="CanelaMpSkel-orderHead">
        <div className="CanelaMpSkel-lines">
          {b('38%', 32)}
          {b('46%', 14)}
        </div>
        {b('120px', 32, 'CanelaMpSkel-end')}
      </div>
      <div className="CanelaMpSkel-split">
        {rows(Math.max(2, n), false)}
        {summary(2)}
      </div>
    </div>
  );
}

/** O painel do vendedor: o estado, os números de venda, a tabela e o formulário da loja. */
function store(): Mithril.Children {
  return (
    <div className="CanelaMpSkel-store">
      <div className="CanelaMpSkel-pair CanelaMpSkel-band">
        {b('60px', 18)}
        {b('64px', 22, 'CanelaMpSkel-pill')}
      </div>
      <div className="CanelaMpSkel-step">
        {b('120px', 20)}
        {b('70%', 14)}
        {b('160px', 36, 'CanelaMpSkel-button')}
      </div>
      <div className="CanelaMpSkel-step">
        {b('180px', 20)}
        <div className="CanelaMpSkel-metrics">
          {repeat(6, (i) => (
            <div key={String(i)} className="CanelaMpSkel-metric">
              {b('60%', 22)}
              {b('80%', 12)}
            </div>
          ))}
        </div>
      </div>
      {rows(3, false)}
      <div className="CanelaMpSkel-step">
        {b('160px', 20)}
        <div className="CanelaMpSkel-field">
          {b('110px', 13)}
          {b('100%', 42)}
        </div>
        <div className="CanelaMpSkel-field">
          {b('90px', 13)}
          {b('100%', 84)}
        </div>
      </div>
    </div>
  );
}

const VARIANTS: Record<string, (count?: number) => Mithril.Children> = {
  cards: (count) => cards(count ?? 6),
  list: (count) => rows(count ?? 5),
  product: () => product(),
  cart: (count) => cart(count ?? 3),
  checkout: () => checkout(),
  order: (count) => order(count ?? 2),
  store: () => store(),
};

export default function installMarketplaceSkeletons(): void {
  override(`${MODULE}MpSkeleton` as any, 'view', function (this: any, original: (...args: any[]) => Mithril.Children, vnode: any) {
    const variant = vnode?.attrs?.variant || 'list';
    const render = VARIANTS[variant];

    if (!thirdParty.marketplace() || !render) return original(vnode);

    return (
      <div className={`CanelaMpSkel CanelaMpSkel--${variant}`} aria-hidden="true">
        {render(vnode.attrs.count)}
      </div>
    );
  });

  // As listas que desenham o próprio skeleton: as linhas da lista de discussões.
  const lists: Record<string, number> = { MyOrdersPage: 4, DownloadsPage: 4, MySubscriptionsPage: 3, MyRefundRequestsPage: 3 };

  Object.entries(lists).forEach(([page, count]) => {
    override(`${MODULE}${page}` as any, 'renderSkeleton', function (original: () => Mithril.Children) {
      if (!thirdParty.marketplace()) return original();

      return (
        <div className="CanelaMpSkel CanelaMpSkel--list" aria-hidden="true">
          {rows(count, page !== 'MySubscriptionsPage')}
        </div>
      );
    });
  });
}
