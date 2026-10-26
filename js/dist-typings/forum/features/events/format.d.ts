export declare function timeOf(date: Date): string;
/** "qui, 22 out 10:00" (com o ano quando não é o corrente). */
export declare function dayAndTime(date: Date, now?: Date): string;
/** "qui, 22 out 10:00 → 11:00" ou, em dias diferentes, as duas datas inteiras. */
export declare function eventRange(start: Date, end: Date | null): string;
/** O fuso de quem lê, como nome de cidade ("São Paulo"). */
export declare function readerZone(): string;
export declare function monthShort(date: Date): string;
/** "em 3 dias", "há 2 dias", "agora": a data do evento na lista e no cabeçalho. */
export declare function relativeEventDate(start: Date, end: Date | null, ended: boolean, now?: Date): string;
/** A recorrência por extenso, a partir da primeira ocorrência. */
export declare function recurrenceLabel(rule: string | null, first: Date): string;
