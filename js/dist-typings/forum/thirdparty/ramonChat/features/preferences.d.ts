/**
 * O som desligado pelo leitor. O ramon/chat grava `ramon-chat.sound` como
 * texto, mas só silencia quando ele vale `false` (utils/sound.ts) — o que um
 * texto nunca vale. Até a correção lá, o tema troca no cliente o som do
 * fórum por "none" para quem escolheu "Nenhum": é o que o `chosen()` dele lê.
 */
export declare function applySoundPreference(): void;
export default function installRamonChatPreferences(): void;
