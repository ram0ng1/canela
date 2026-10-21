<?php

declare(strict_types=1);

namespace Ramon\Canela\Profile;

/**
 * Transforma a bio (texto puro) em HTML seguro.
 *
 * Não usa o formatter do Flarum de propósito: ele carrega a configuração de
 * todas as extensões (menções, BBCode, embeds…), e algumas esperam um post
 * como contexto. A bio aceita pouco além de links e ênfase, e um
 * renderizador pequeno, que escapa TUDO antes de acrescentar as poucas tags
 * permitidas, não tem como deixar passar HTML do usuário.
 *
 * Aceita: parágrafos (linha em branco), quebras de linha, links http(s)
 * soltos, **negrito**, *itálico* e `código`.
 */
final class BioRenderer
{
    /** Link solto até o primeiro espaço ou aspas (a pontuação final sai em link()). */
    private const URL_PATTERN = '~(https?://[^\s<>"\'`]+)~iu';

    private const LINK_LABEL_MAX = 40;

    /**
     * Controles C0/C1 (menos \t e \n) e os de direção do texto: os de
     * direção servem para disfarçar o que se lê (um link que parece outro).
     * O ZWJ e os seletores de variação ficam, porque montam os emojis.
     */
    public const CONTROL_PATTERN = '/[\x{0000}-\x{0008}\x{000B}\x{000C}\x{000E}-\x{001F}\x{007F}-\x{009F}\x{202A}-\x{202E}\x{2066}-\x{2069}]/u';

    public function render(?string $text): ?string
    {
        if ($text === null || trim($text) === '') {
            return null;
        }

        $paragraphs = preg_split('/\n\s*\n/u', trim($text)) ?: [];
        $html = '';

        foreach ($paragraphs as $paragraph) {
            $lines = array_map(fn (string $line) => $this->inline($line), explode("\n", trim($paragraph)));
            $html .= '<p>'.implode('<br>', $lines).'</p>';
        }

        return $html;
    }

    /**
     * Normaliza o que o usuário enviou antes de gravar: quebras de linha
     * únicas, sem caracteres de controle (que não aparecem, mas confundem
     * leitores de tela e buscas) e sem mais de uma linha em branco seguida.
     */
    public static function normalize(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = (string) preg_replace(self::CONTROL_PATTERN, '', $text);
        $text = (string) preg_replace("/\n{3,}/", "\n\n", $text);
        $text = trim($text);

        return $text === '' ? null : $text;
    }

    /** Uma linha: links primeiro, ênfase só no texto entre eles. */
    private function inline(string $line): string
    {
        $parts = preg_split(self::URL_PATTERN, $line, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$line];
        $html = '';

        foreach ($parts as $index => $part) {
            // Com DELIM_CAPTURE, os índices ímpares são as URLs capturadas.
            $html .= $index % 2 === 1 ? $this->link($part) : $this->emphasis($part);
        }

        return $html;
    }

    private function link(string $url): string
    {
        // "veja https://x.com." — o ponto é da frase, não do endereço. Um ")"
        // só fica no link se abrir parêntese dentro dele (Wikipédia).
        $trailing = '';

        while ($url !== '' && preg_match('/[.,;:!?\])]$/', $url)) {
            $last = substr($url, -1);

            if ($last === ')' && substr_count($url, '(') >= substr_count($url, ')')) {
                break;
            }

            $trailing = $last.$trailing;
            $url = substr($url, 0, -1);
        }

        if (! preg_match('~^https?://[^/?#.]+\.[^/?#]+~i', $url)) {
            return $this->escape($url.$trailing);
        }

        $label = (string) preg_replace('~^https?://(www\.)?~i', '', $url);

        if (mb_strlen($label) > self::LINK_LABEL_MAX) {
            $label = mb_substr($label, 0, self::LINK_LABEL_MAX - 1).'…';
        }

        return sprintf(
            '<a href="%s" rel="ugc nofollow noopener" target="_blank">%s</a>',
            $this->escape($url),
            $this->escape($label)
        ).$this->escape($trailing);
    }

    private function emphasis(string $text): string
    {
        // O código fica intocado: dentro dele, `*` é só um asterisco.
        $segments = preg_split('/(`[^`\n]+`)/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$text];
        $html = '';

        foreach ($segments as $index => $segment) {
            if ($index % 2 === 1) {
                $html .= '<code>'.$this->escape(substr($segment, 1, -1)).'</code>';
                continue;
            }

            // Escapar antes de procurar a ênfase: as tags que entram depois são
            // as únicas do resultado, e `*` passa intacto pelo escape.
            $escaped = $this->escape($segment);
            $escaped = (string) preg_replace('/\*\*(?=\S)(.+?)(?<=\S)\*\*/u', '<strong>$1</strong>', $escaped);
            $escaped = (string) preg_replace('/(?<![*\w])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![*\w])/u', '<em>$1</em>', $escaped);

            $html .= $escaped;
        }

        return $html;
    }

    private function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
    }
}
