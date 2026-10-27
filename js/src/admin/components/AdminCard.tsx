/*
 * O card do painel e as primitivas de layout do miolo. São POJOs com `view`
 * (formato de componente que o Mithril aceita), tipados como `any` para o JSX
 * aceitá-los.
 *
 * Estados do card de um recurso (CardDef com `master`):
 * - ligado: a chave do cabeçalho ligada e o miolo à vista;
 * - desligado: só o cabeçalho (título, o que faz, a chave) — o miolo some;
 * - trancado: falta uma extensão (ou outro requisito); a chave fica travada e
 *   o motivo aparece no lugar do miolo.
 */
import app from 'flarum/admin/app';
import Link from 'flarum/common/components/Link';

import type { CardDef } from '../types';
import { extensionInstalled, extensionName, getBool, missingExtension, trans } from '../util';
import { AdminSwitch } from './AdminSwitch';
import { setBool } from './AdminToggle';

const KEY = 'ramon-canela.admin.settings.shell';

/** Por que o card está trancado, ou `null`. */
export const lockReason = (card: CardDef): { text: string; extension?: string } | null => {
  const missing = missingExtension(card.extensions);
  if (missing) {
    return {
      extension: missing,
      text: extensionInstalled(missing)
        ? trans(`${KEY}.extension_disabled`, { name: extensionName(missing) })
        : trans(`${KEY}.extension_missing`, { name: extensionName(missing) }),
    };
  }

  const reason = card.lockedBy?.() ?? null;

  return reason ? { text: reason } : null;
};

/** As chaves de cabeçalho sendo gravadas agora (mais de um card pode estar salvando). */
const savingMasters = new Set<string>();

export const AdminCard: any = {
  view({ attrs: { card, groupLabel } }: { attrs: { card: CardDef; groupLabel?: string } }) {
    const lock = lockReason(card);
    const hasMaster = !!card.master;
    const on = hasMaster ? !lock && getBool(card.master!) : !lock;
    const titleId = `CanelaAdmin-card-${card.id}-title`;
    const descId = `CanelaAdmin-card-${card.id}-desc`;
    // Ao ligar, o miolo só aparece depois que a chave foi gravada: o que ele
    // busca ao abrir (a lista de relatos, por exemplo) chegaria antes do
    // salvamento e acharia o recurso ainda desligado (404).
    const body = on && !savingMasters.has(card.master ?? '') && card.body ? card.body() : null;

    return (
      <section
        id={`CanelaAdmin-card-${card.id}`}
        className={`CanelaAdmin-card${hasMaster ? ' is-feature' : ''}${hasMaster && !on ? ' is-off' : ''}${lock ? ' is-locked' : ''}${body ? '' : ' is-empty'}`}
        aria-labelledby={titleId}
      >
        <header className="CanelaAdmin-card-header">
          <span className="CanelaAdmin-card-icon">
            <i className={card.icon} aria-hidden="true" />
          </span>
          <div className="CanelaAdmin-card-heading">
            <h3 className="CanelaAdmin-card-title" id={titleId}>
              {card.title()}
              {groupLabel && <span className="CanelaAdmin-card-group">{groupLabel}</span>}
            </h3>
            {card.description && (
              <p className="CanelaAdmin-card-desc" id={descId}>
                {card.description()}
              </p>
            )}
          </div>
          <span className="CanelaAdmin-card-saved" aria-live="polite">
            <i className="fas fa-check" aria-hidden="true" />
            {trans(`${KEY}.saved`)}
          </span>
          {hasMaster && (
            <div className="CanelaAdmin-card-master">
              <span className="CanelaAdmin-card-state">{lock ? trans(`${KEY}.locked`) : on ? trans(`${KEY}.on`) : trans(`${KEY}.off`)}</span>
              <AdminSwitch
                state={on}
                disabled={!!lock}
                saving={savingMasters.has(card.master!)}
                label={card.title()}
                describedBy={card.description ? descId : undefined}
                onchange={(checked: boolean) => {
                  const key = card.master!;

                  savingMasters.add(key);
                  setBool(key, checked).finally(() => {
                    savingMasters.delete(key);
                    m.redraw();
                  });
                }}
              />
            </div>
          )}
        </header>

        {lock && (
          <div className="CanelaAdmin-card-lock">
            <i className={lock.extension ? 'fas fa-plug-circle-xmark' : 'fas fa-lock'} aria-hidden="true" />
            <span>{lock.text}</span>
            {lock.extension && extensionInstalled(lock.extension) && (
              <Link className="CanelaAdmin-card-lockLink" href={app.route('extension', { id: lock.extension })}>
                {trans(`${KEY}.open_extension`)}
              </Link>
            )}
          </div>
        )}

        {body && <div className="CanelaAdmin-card-body">{body}</div>}
      </section>
    );
  },
};

/** Aviso em destaque dentro de um card: dependências, efeitos colaterais. */
export const AdminNotice: any = {
  view({ attrs: { icon = 'fas fa-circle-info' }, children }: any) {
    return (
      <p className="CanelaAdmin-notice">
        <i className={icon} aria-hidden="true" />
        <span>{children}</span>
      </p>
    );
  },
};

export const SubDivider: any = {
  view() {
    return <div className="CanelaAdmin-subDivider" />;
  },
};

/** Opções que dependem da de cima, recuadas num bloco. */
export const AdminSubGroup: any = {
  view({ children }: any) {
    return <div className="CanelaAdmin-subGroup">{children}</div>;
  },
};

/** Um título pequeno que separa blocos dentro de um card. */
export const SubTitle: any = {
  view({ children }: any) {
    return <h4 className="CanelaAdmin-subTitle">{children}</h4>;
  },
};
