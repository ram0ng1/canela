/*
 * O gráfico "Visualizações recentes" do mapa do tópico (topic-views-chart do
 * Discourse), desenhado em SVG.
 *
 * O Discourse usa o Chart.js; aqui a mesma figura sai em SVG para não pôr
 * 200 KB de biblioteca no fórum por um gráfico de linha. Os cálculos são os
 * dele, um por um:
 *
 * - os dias sem visualização entram com zero (fillMissingDates);
 * - o ponto de hoje é trocado por uma PREVISÃO (predictTodaysViews: média
 *   móvel ponderada de 3 dias, ajustada pela parte do dia que já passou),
 *   ligada a ontem por uma linha tracejada;
 * - o eixo X vai do primeiro dia a hoje, com os marcos do Chart.js (passo
 *   "redondo" de 1, 2, 5 ou 10 dias, no máximo 15 marcos e um a cada ~40px);
 * - o eixo Y começa em zero, com os marcos "redondos" do Chart.js;
 * - a dica mostra a data (dd/mm/aaaa) e "Visualizações: N" ou, no ponto de
 *   hoje, "Visualizações previstas: N".
 *
 * As cores são as do `.topic-map` de lá: a linha e os pontos no tom médio da
 * cor de destaque, a previsão em cinza (`--chart-*-color`, no LESS).
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';

import { t } from '../../../utils/settings';
import { localNumber, viewDurationHours } from '../../../utils/views';
import type { ViewStat } from './viewStats';

const ONE_DAY = 86400000;

interface Point {
  x: number;
  y: number;
}

export interface TopicViewsChartAttrs extends ComponentAttrs {
  stats: ViewStat[];
}

function startOfDayUTC(): number {
  const now = new Date();

  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function fillMissingDates(data: Point[]): Point[] {
  const filled: Point[] = [];
  let current = data[0].x;

  data.forEach((point) => {
    while (current < point.x) {
      filled.push({ x: current, y: 0 });
      current += ONE_DAY;
    }

    filled.push(point);
    current = point.x + ONE_DAY;
  });

  return filled;
}

function weightedMovingAverage(data: Point[], period = 3): (number | null)[] {
  const weights = Array.from({ length: period }, (_, i) => i + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);

  return data.map((_, i) => {
    if (i < period - 1) return null;

    let weighted = 0;
    for (let j = 0; j < period; j++) weighted += data[i - j].y * weights[j];

    return Math.round(weighted / weightSum);
  });
}

function predictTodaysViews(data: Point[]): number {
  const movingAvg = weightedMovingAverage(data);
  const lastMovingAvg = movingAvg[movingAvg.length - 1] ?? 0;
  const currentViews = data[data.length - 1].y;
  const now = new Date();
  const currentTimeUTC = Date.now() + now.getTimezoneOffset() * 60 * 1000;
  // A mesma conta do Discourse (que soma o fuso ao relógio antes de comparar
  // com a meia-noite UTC), para a previsão dar o mesmo número de lá.
  const elapsed = (currentTimeUTC - startOfDayUTC()) / ONE_DAY;

  const adjusted =
    currentViews >= lastMovingAvg ? currentViews + (currentViews - lastMovingAvg) * (1 - elapsed) : currentViews + lastMovingAvg * (1 - elapsed);

  return Math.round(Math.max(adjusted, currentViews));
}

/** O `niceNum` do Chart.js: 1, 2, 5 ou 10 vezes uma potência de 10. */
function niceNum(range: number): number {
  const rounded = Math.round(range);
  const value = Math.abs(range - rounded) <= range / 1000 ? rounded : range;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return nice * magnitude;
}

/** Marcos do eixo X: min e max fixos, passo de dias inteiros (generateTicks do Chart.js). */
function xTicks(min: number, max: number, maxTicks: number): number[] {
  const range = max - min;

  if (range <= 0) return [min];

  const spacing = niceNum(range / Math.max(1, maxTicks - 1) / ONE_DAY) * ONE_DAY;
  const spaces = Math.max(1, Math.round(Math.min(range / spacing, maxTicks)));
  const step = range / spaces;

  return Array.from({ length: spaces + 1 }, (_, i) => min + i * step);
}

/** Marcos do eixo Y, de zero ao primeiro número "redondo" acima do máximo. */
function yTicks(dataMax: number, maxTicks: number): number[] {
  const max = dataMax > 0 ? dataMax : 1;
  const spacing = niceNum(max / Math.max(1, maxTicks - 1));
  const niceMax = Math.ceil(max / spacing) * spacing;
  const spaces = Math.round(niceMax / spacing);
  // Arredonda pela casa do passo: 0,1 + 0,2 não pode virar 0,30000000000000004.
  const decimals = Math.max(0, -Math.floor(Math.log10(spacing)));

  return Array.from({ length: spaces + 1 }, (_, i) => Number((i * spacing).toFixed(decimals)));
}

function dayLabel(x: number, withYear = false): string {
  // As datas são dias UTC; em UTC a etiqueta é o próprio dia, em qualquer fuso.
  return new Date(x).toLocaleDateString(document.documentElement.lang || undefined, {
    timeZone: 'UTC',
    month: '2-digit',
    day: '2-digit',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

const FONT_SIZE = 12;
const LINE_HEIGHT = FONT_SIZE * 1.2;
const TICK_LENGTH = 8;
const TICK_PADDING = 3;

export default class TopicViewsChart extends Component<TopicViewsChartAttrs> {
  width = 0;
  hover: number | null = null;
  resize?: () => void;
  measurer?: CanvasRenderingContext2D | null;

  oncreate(vnode: Mithril.VnodeDOM<TopicViewsChartAttrs, this>) {
    super.oncreate(vnode);
    this.measure();

    this.resize = () => {
      if (this.measure()) m.redraw();
    };
    window.addEventListener('resize', this.resize);
  }

  onremove(vnode: Mithril.VnodeDOM<TopicViewsChartAttrs, this>) {
    super.onremove(vnode);
    if (this.resize) window.removeEventListener('resize', this.resize);
  }

  /** O Chart.js é "responsive": a largura é a do menu, a altura a metade (aspectRatio 2). */
  measure(): boolean {
    const box = this.element?.querySelector('.CanelaViewsChart-canvas') as HTMLElement | null;
    if (!box) return false;

    // clientWidth inclui o padding do bloco (o do `canvas` de lá); o gráfico
    // ocupa só o miolo.
    const style = getComputedStyle(box);
    const width = Math.floor(box.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));

    if (!width || width === this.width) return false;

    this.width = width;
    m.redraw();

    return true;
  }

  textWidth(text: string): number {
    if (this.measurer === undefined) {
      this.measurer = document.createElement('canvas').getContext('2d');
      if (this.measurer) this.measurer.font = `${FONT_SIZE}px ${getComputedStyle(this.element || document.body).fontFamily}`;
    }

    return this.measurer ? this.measurer.measureText(text).width : text.length * FONT_SIZE * 0.6;
  }

  view() {
    const stats = this.attrs.stats || [];

    if (!stats.length) {
      return <div className="CanelaViewsChart CanelaViewsChart--error">{t('stats.views.chart_error')}</div>;
    }

    return (
      <div className="CanelaViewsChart">
        <div className="CanelaViewsChart-canvas">{this.width > 0 && this.chart(stats)}</div>
        <div className="CanelaViewsChart-explainer view-explainer">{t('stats.views.view_explainer', { hours: viewDurationHours() })}</div>
      </div>
    );
  }

  chart(stats: ViewStat[]): Mithril.Children {
    const today = startOfDayUTC();

    let data: Point[] = stats.map((stat) => ({ x: new Date(`${stat.viewed_at}T00:00:00Z`).getTime(), y: stat.views }));
    data = fillMissingDates(data);

    const lastDay = data[data.length - 1];
    const predicted = { x: lastDay.x, y: predictTodaysViews(data) };

    data = [...data.slice(0, -1), predicted];

    const actual = data.slice(0, -1);
    const prediction = data.length > 1 ? [data[data.length - 2], data[data.length - 1]] : [predicted];

    const width = this.width;
    const height = Math.round(width / 2);

    const plotHeightGuess = height - (LINE_HEIGHT + TICK_PADDING + TICK_LENGTH) - LINE_HEIGHT / 2;
    const yValues = yTicks(Math.max(...data.map((point) => point.y)), Math.max(2, Math.min(11, Math.ceil(plotHeightGuess / LINE_HEIGHT))));
    const yLabels = yValues.map((value) => localNumber(value, String(value).split('.')[1]?.length || 0));
    const left = Math.ceil(Math.max(...yLabels.map((label) => this.textWidth(label)))) + TICK_PADDING + TICK_LENGTH;

    const xMin = data[0].x;
    const xMax = lastDay.x;
    const firstLabel = this.textWidth(dayLabel(xMin));
    const lastLabel = this.textWidth(dayLabel(xMax));
    const plotLeft = Math.max(left, Math.ceil(firstLabel / 2));
    const plotRight = width - Math.ceil(lastLabel / 2) - 1;
    const plotTop = Math.ceil(LINE_HEIGHT / 2);
    const plotBottom = height - Math.ceil(LINE_HEIGHT + TICK_PADDING + TICK_LENGTH);
    const plotWidth = Math.max(1, plotRight - plotLeft);

    const xValues = xTicks(xMin, xMax, Math.max(2, Math.min(15, Math.ceil(plotWidth / 40))));
    const yMax = yValues[yValues.length - 1] || 1;

    const sx = (x: number) => (xMax === xMin ? plotLeft + plotWidth / 2 : plotLeft + ((x - xMin) / (xMax - xMin)) * plotWidth);
    const sy = (y: number) => plotBottom - (y / yMax) * (plotBottom - plotTop);
    const path = (points: Point[]) => points.map((point, i) => `${i ? 'L' : 'M'}${sx(point.x).toFixed(1)},${sy(point.y).toFixed(1)}`).join(' ');

    const hovered = this.hover !== null ? data[this.hover] : null;
    const isPrediction = (index: number) => index === data.length - 1;

    const onmove = (event: MouseEvent & { redraw?: boolean }) => {
      // O Mithril redesenha depois de cada evento; aqui só quando o ponto muda.
      event.redraw = false;

      const svg = event.currentTarget as SVGSVGElement;
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * width;
      let nearest = 0;

      data.forEach((point, i) => {
        if (Math.abs(sx(point.x) - x) < Math.abs(sx(data[nearest].x) - x)) nearest = i;
      });

      if (nearest !== this.hover) {
        this.hover = nearest;
        m.redraw();
      }
    };

    return (
      <svg
        className="CanelaViewsChart-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('stats.views.menu_title')}
        onmousemove={onmove}
        onmouseleave={() => {
          this.hover = null;
        }}
      >
        <title>{t('stats.views.menu_title')}</title>

        <g className="CanelaViewsChart-grid">
          {yValues.map((value) => (
            <line x1={plotLeft - TICK_LENGTH} x2={plotRight} y1={sy(value)} y2={sy(value)} />
          ))}
          {xValues.map((value) => (
            <line x1={sx(value)} x2={sx(value)} y1={plotTop} y2={plotBottom + TICK_LENGTH} />
          ))}
        </g>

        <g className="CanelaViewsChart-ticks CanelaViewsChart-ticks--y">
          {yValues.map((value, i) => (
            <text x={plotLeft - TICK_LENGTH - TICK_PADDING} y={sy(value)} text-anchor="end" dominant-baseline="central">
              {yLabels[i]}
            </text>
          ))}
        </g>

        <g className="CanelaViewsChart-ticks CanelaViewsChart-ticks--x">
          {xValues.map((value) => (
            <text x={sx(value)} y={plotBottom + TICK_LENGTH + TICK_PADDING} text-anchor="middle" dominant-baseline="hanging">
              {dayLabel(Math.round(value))}
            </text>
          ))}
        </g>

        {actual.length > 1 && <path className="CanelaViewsChart-line" d={path(actual)} />}
        {prediction.length > 1 && <path className="CanelaViewsChart-line CanelaViewsChart-line--predicted" d={path(prediction)} />}

        <g className="CanelaViewsChart-points">
          {data.map((point, i) => (
            <circle
              className={isPrediction(i) ? 'CanelaViewsChart-point CanelaViewsChart-point--predicted' : 'CanelaViewsChart-point'}
              cx={sx(point.x)}
              cy={sy(point.y)}
              r={this.hover === i ? 4 : 3}
            />
          ))}
        </g>

        {hovered &&
          this.hover !== null &&
          this.tooltip(
            hovered,
            sx(hovered.x),
            sy(hovered.y),
            width,
            height,
            hovered.x === today && isPrediction(this.hover),
            isPrediction(this.hover)
          )}
      </svg>
    );
  }

  /** A dica do Chart.js: caixa escura de cantos arredondados, título em negrito e o quadradinho da cor. */
  tooltip(point: Point, x: number, y: number, width: number, height: number, predictedLabel: boolean, predictedColor: boolean): Mithril.Children {
    const title = dayLabel(point.x, true);
    const label = `${predictedLabel ? t('stats.views.predicted_views') : t('stats.views.views')}: ${point.y}`;
    const padding = 6;
    const box = FONT_SIZE;
    const boxWidth = Math.ceil(Math.max(this.textWidth(title), box + 4 + this.textWidth(label))) + padding * 2;
    const boxHeight = Math.ceil(padding * 2 + LINE_HEIGHT * 2 + 6);
    const caret = 5;

    // Como o Chart.js: à direita do ponto, ou à esquerda se não couber.
    const onRight = x + caret + boxWidth <= width;
    const bx = onRight ? x + caret + 2 : x - caret - 2 - boxWidth;
    const by = Math.min(Math.max(0, y - boxHeight / 2), height - boxHeight);

    return (
      <g className="CanelaViewsChart-tooltip" pointer-events="none">
        <rect x={bx} y={by} width={boxWidth} height={boxHeight} rx="6" ry="6" />
        <text className="CanelaViewsChart-tooltipTitle" x={bx + padding} y={by + padding} dominant-baseline="hanging">
          {title}
        </text>
        <rect
          className={predictedColor ? 'CanelaViewsChart-tooltipSwatch CanelaViewsChart-tooltipSwatch--predicted' : 'CanelaViewsChart-tooltipSwatch'}
          x={bx + padding}
          y={by + padding + LINE_HEIGHT + 6 + (LINE_HEIGHT - box) / 2}
          width={box}
          height={box}
        />
        <text className="CanelaViewsChart-tooltipLabel" x={bx + padding + box + 4} y={by + padding + LINE_HEIGHT + 6} dominant-baseline="hanging">
          {label}
        </text>
      </g>
    );
  }
}
