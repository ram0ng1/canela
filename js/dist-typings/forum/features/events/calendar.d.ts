import type { EventData } from './model';
export declare function googleCalendarUrl(event: EventData, title: string, link: string): string;
export declare function downloadIcs(event: EventData, title: string, link: string): void;
