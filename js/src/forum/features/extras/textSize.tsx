/*
 * "Tamanho do texto" das preferências de interface do Discourse: Menor,
 * Normal, Maior e Máximo, em Configurações.
 *
 * É uma escolha do aparelho (o celular pode querer letra maior que o
 * computador), por isso fica no localStorage e não nas preferências da conta.
 * Vira uma classe no <html> (`canela-text-larger`…), e o CSS escala a fonte
 * base a partir dela.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import FieldSet from 'flarum/common/components/FieldSet';
import Select from 'flarum/common/components/Select';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';

const STORAGE_KEY = 'canela.textSize';

/** Tamanho => classe no <html>. `normal` não põe classe nenhuma. */
const SIZES = ['smaller', 'normal', 'larger', 'largest'] as const;
type TextSize = (typeof SIZES)[number];

function enabled(): boolean {
  return forumBool('canelaTextSizeEnabled', true);
}

function stored(): TextSize {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return (SIZES as readonly string[]).includes(value || '') ? (value as TextSize) : 'normal';
  } catch {
    // localStorage bloqueado (janela privada, cookies desligados): fica o normal.
    return 'normal';
  }
}

function applySize(size: TextSize): void {
  const root = document.documentElement;

  SIZES.forEach((item) => root.classList.remove(`canela-text-${item}`));

  if (size !== 'normal') root.classList.add(`canela-text-${size}`);
}

function save(size: TextSize): void {
  try {
    if (size === 'normal') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Sem armazenamento a escolha vale só até recarregar — melhor que nada.
  }

  applySize(size);
}

export default function installTextSize(): void {
  // No mount, e não no initializer: as configurações do fórum só existem depois.
  extend(app as any, 'mount', function () {
    if (enabled()) applySize(stored());
  });

  // O SettingsPage é carregado sob demanda; o extend por caminho espera o módulo.
  extend('flarum/forum/components/SettingsPage', 'settingsItems', function (items: ItemList<Mithril.Children>) {
    if (!enabled()) return;

    const options: Record<string, string> = {};
    SIZES.forEach((size) => (options[size] = t(`extras.text_size.${size}`)));

    items.add(
      'canelaInterface',
      <FieldSet className="Settings-canelaInterface FieldSet--min" label={t('extras.text_size.heading')}>
        <div className="Form-group CanelaTextSize">
          <label className="CanelaTextSize-label" for="canela-text-size">
            {t('extras.text_size.label')}
          </label>
          <Select id="canela-text-size" options={options} value={stored()} onchange={(value: TextSize) => save(value)} />
          <p className="helpText">{t('extras.text_size.help')}</p>
        </div>
      </FieldSet>,
      // Entre "Aparelho" (70) e "Esquema de cores" (60).
      65
    );
  });
}
