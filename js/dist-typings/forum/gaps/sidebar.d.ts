interface CustomLink {
    label: string;
    href: string;
    icon: string;
}
/** Lê a configuração de links personalizados; linhas mal formadas ficam de fora. */
export declare function customLinks(): CustomLink[];
export default function installSidebarGaps(): void;
export {};
