/*
 * Os ícones de loja do ramon/marketplace no Lucide.
 *
 * O mapa do tema (icons/iconMap.ts) é o do componente "Discourse Lucide
 * Icons", que não tem ícones de comércio: loja, carrinho, recibo e caixa
 * ficariam no Font Awesome sólido, no meio dos ícones de traço. Aqui eles
 * entram no mapa e nos desenhos antes do primeiro desenho do fórum (este
 * módulo roda no initializer), com os nomes do Font Awesome que a extensão
 * usa (`fa-store`, `fa-shopping-cart`, `fa-receipt`…).
 */
import type { IconNode } from 'lucide';
import {
  BellRing,
  CirclePlay,
  Infinity as InfinityIcon,
  LoaderCircle,
  Package,
  PackageOpen,
  Paperclip,
  QrCode,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  StickyNote,
  Store,
  Ticket,
  TrendingUp,
  Unlink,
  Zap,
} from 'lucide';

import { CANELA_EXTRAS } from '../../icons/iconMap';
import { GLYPHS } from '../../icons/glyphs';

/** Nome do Font Awesome (sem `fa-`, já no FA 6 ou no apelido antigo) → nome do Lucide. */
const NAMES: Record<string, string> = {
  store: 'store',
  'store-alt': 'store',
  shop: 'store',
  'shopping-cart': 'shopping-cart',
  'cart-shopping': 'shopping-cart',
  'cart-plus': 'shopping-cart',
  'cart-arrow-down': 'shopping-cart',
  receipt: 'receipt',
  box: 'package',
  'box-open': 'package-open',
  boxes: 'boxes',
  'boxes-stacked': 'boxes',
  'concierge-bell': 'bell-ring',
  'bell-concierge': 'bell-ring',
  'circle-notch': 'loader-circle',
  ticket: 'ticket',
  'ticket-alt': 'ticket',
  'ticket-simple': 'ticket',
  'play-circle': 'circle-play',
  'circle-play': 'circle-play',
  infinity: 'infinity',
  bolt: 'zap',
  'sticky-note': 'sticky-note',
  'note-sticky': 'sticky-note',
  'arrow-up-right-dots': 'trending-up',
  unlink: 'unlink',
  'link-slash': 'unlink',
  'shopping-bag': 'shopping-bag',
  'bag-shopping': 'shopping-bag',
  qrcode: 'qr-code',
  paperclip: 'paperclip',
  'hourglass-half': 'hourglass',
};

const DRAWINGS: Record<string, IconNode> = {
  'bell-ring': BellRing,
  'circle-play': CirclePlay,
  infinity: InfinityIcon,
  'loader-circle': LoaderCircle,
  package: Package,
  'package-open': PackageOpen,
  paperclip: Paperclip,
  'qr-code': QrCode,
  receipt: Receipt,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'sticky-note': StickyNote,
  store: Store,
  ticket: Ticket,
  'trending-up': TrendingUp,
  unlink: Unlink,
  zap: Zap,
};

export default function installMarketplaceIcons(): void {
  // Sem sobrescrever o que o tema já mapeia (o desenho dele vence).
  for (const [fa, lucide] of Object.entries(NAMES)) if (!(fa in CANELA_EXTRAS)) CANELA_EXTRAS[fa] = lucide;
  for (const [name, node] of Object.entries(DRAWINGS)) if (!(name in GLYPHS)) GLYPHS[name] = node;
}
