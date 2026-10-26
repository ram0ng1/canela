export declare const gaps: {
    postShortcuts: () => boolean;
    lightbox: () => boolean;
    codeButtons: () => boolean;
    headingAnchors: () => boolean;
    spoilerBlur: () => boolean;
    mentionCards: () => boolean;
    readState: () => boolean;
    timelineBack: () => boolean;
    titleEditor: () => boolean;
    shareModal: () => boolean;
    lastVisit: () => boolean;
    dismiss: () => boolean;
    tableExpand: () => boolean;
};
/** Os recursos com backend: só com o extend/gaps.php carregado. */
export declare function gapsBackend(): boolean;
export declare function gapsBackendOn(attribute: string): boolean;
/** O texto de uma configuração de texto livre, já sem espaços nas pontas. */
export declare function forumString(attribute: string): string;
