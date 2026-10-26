import Page from 'flarum/common/components/Page';
import type Mithril from 'mithril';
export default class EventsPage extends Page {
    private mode;
    private month;
    private items;
    private monthItems;
    oninit(vnode: Mithril.Vnode): void;
    private setView;
    private loadMonth;
    private shiftMonth;
    view(): Mithril.Children;
    private list;
    private calendar;
}
