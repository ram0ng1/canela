export type ReminderPreset = 'later_today' | 'tomorrow' | 'next_week' | 'next_month' | 'custom' | 'none';
/** O horário de cada atalho, ou `null` quando ele não vale agora. */
export declare function presetDate(preset: ReminderPreset, now?: Date): Date | null;
/** Os atalhos que fazem sentido agora, na ordem. */
export declare function availablePresets(now?: Date): ReminderPreset[];
/** "sáb, 08:00" — o que aparece ao lado do nome de cada atalho. */
export declare function presetHint(date: Date, now?: Date): string;
/** Data longa do lembrete: "sábado, 18 de outubro, 08:00". */
export declare function reminderLabel(date: Date): string;
/** `YYYY-MM-DD` e `HH:MM` no fuso local, para os campos `date` e `time`. */
export declare function toLocalInputs(date: Date): {
    date: string;
    time: string;
};
/** O inverso: os campos do horário personalizado viram um instante (ou `null` se incompletos). */
export declare function fromLocalInputs(dateValue: string, timeValue: string): Date | null;
