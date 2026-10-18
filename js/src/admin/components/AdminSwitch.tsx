/*
 * A chave liga/desliga do painel: um <button role="switch">, e não o Switch
 * do core (um checkbox com rótulo), para caber no cabeçalho do card ao lado do
 * título e ter o tamanho e o estado de gravação do painel. O teclado vem de
 * graça com o <button> (Espaço e Enter).
 */
export const AdminSwitch: any = {
  view({ attrs: { state, disabled, saving, onchange, label, id, describedBy } }: any) {
    return (
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={state ? 'true' : 'false'}
        aria-label={label}
        aria-describedby={describedBy}
        disabled={!!disabled}
        className={`CanelaSwitch${state ? ' is-on' : ''}${saving ? ' is-saving' : ''}`}
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          if (!disabled) onchange(!state);
        }}
      >
        <span className="CanelaSwitch-thumb" aria-hidden="true" />
      </button>
    );
  },
};
