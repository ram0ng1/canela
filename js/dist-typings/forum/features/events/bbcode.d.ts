export interface EventForm {
    name: string;
    /** "2026-10-30 10:00" no fuso `timezone`. */
    start: string;
    end: string;
    timezone: string;
    status: 'public' | 'standalone';
    recurrence: string;
    until: string;
    url: string;
    location: string;
    max: string;
    chat: boolean;
    description: string;
}
/** O fuso do navegador, o padrão do formulário. */
export declare function browserZone(): string;
export declare function emptyForm(): EventForm;
export declare function buildEvent(form: EventForm): string;
/** O primeiro [event] do texto, com a posição dele, ou null. */
export declare function findEvent(text: string): {
    start: number;
    end: number;
    form: EventForm;
} | null;
