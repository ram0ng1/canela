export interface Slide {
    src: string;
    alt: string;
    width: number;
    height: number;
}
export declare function openLightbox(slides: Slide[], index?: number): void;
export default function installLightbox(): void;
