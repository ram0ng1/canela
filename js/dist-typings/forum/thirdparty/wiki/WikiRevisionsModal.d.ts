import { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
import HistoryModal, { type Version, type VersionList } from '../../features/extras/history/HistoryModal';
export interface WikiRevisionsModalAttrs extends IInternalModalAttrs {
    article: any;
}
interface WikiVersion extends Version {
    title: string;
    summary: string;
    model: any;
}
export default class WikiRevisionsModal extends HistoryModal<WikiRevisionsModalAttrs> {
    /** As versões com os campos da wiki (título, resumo e o modelo da revisão). */
    wikiVersions(): WikiVersion[];
    load(): Promise<VersionList>;
    className(): string;
    title(): Mithril.Children;
    content(): Mithril.Children;
    /** A lista ao lado, da mais nova para a mais antiga, como no painel da wiki. */
    revisionList(): Mithril.Children;
    /** O resumo e a troca de título da revisão vêm antes do diff do texto. */
    comparison(): Mithril.Children;
}
export {};
