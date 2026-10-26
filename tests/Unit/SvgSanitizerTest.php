<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Theme\Logo\SvgSanitizer;

/** O logo em SVG vai inline na página: nada que rode script ou busque fora. */
final class SvgSanitizerTest extends TestCase
{
    private function clean(string $svg): string
    {
        return (string) SvgSanitizer::sanitize($svg);
    }

    public function test_logo_comum_passa(): void
    {
        $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><path d="M0 0h10v10z" fill="url(#g)"/></svg>';
        $out = $this->clean($svg);

        self::assertStringContainsString('fill="url(#g)"', $out);
        self::assertStringContainsString('<linearGradient', $out);
    }

    public function test_recusa_o_que_nao_e_svg(): void
    {
        self::assertNull(SvgSanitizer::sanitize(''));
        self::assertNull(SvgSanitizer::sanitize('<html><body/></html>'));
        self::assertNull(SvgSanitizer::sanitize('<svg'));
        self::assertNull(SvgSanitizer::sanitize('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>'));
    }

    public function test_tira_script_eventos_e_elementos_desconhecidos(): void
    {
        $out = $this->clean('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><foreignObject><div/></foreignObject><a href="javascript:alert(1)"><path d="M0 0"/></a><animate attributeName="href" to="javascript:alert(1)"/><rect onclick="x()" width="1"/><!-- c --><?pi x?></svg>');

        foreach (['onload', 'script', 'foreignObject', 'javascript', 'animate', 'onclick', '<!--', '<?pi'] as $needle) {
            self::assertStringNotContainsStringIgnoringCase($needle, $out, $needle);
        }

        self::assertStringContainsString('<rect width="1"/>', $out);
    }

    public function test_href_so_interno_ou_imagem_embutida(): void
    {
        $out = $this->clean('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#a"/><use xlink:href="https://evil.test/x.svg#a"/><image href="data:image/png;base64,AAAA"/><image href="data:image/svg+xml;base64,AAAA"/></svg>');

        self::assertStringContainsString('href="#a"', $out);
        self::assertStringContainsString('data:image/png;base64,AAAA', $out);
        self::assertStringNotContainsString('evil.test', $out);
        self::assertStringNotContainsString('svg+xml', $out);
    }

    public function test_css_sem_endereco_externo(): void
    {
        $out = $this->clean('<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.test/a.css);</style><rect style="fill:url(https://evil.test/p)"/><path style="fill:red"/></svg>');

        self::assertStringNotContainsString('evil.test', $out);
        self::assertStringContainsString('style="fill:red"', $out);
    }

    /** `\75 rl(` e `@\69mport` são `url(` e `@import` para o navegador. */
    public function test_css_com_escape_nao_passa(): void
    {
        $out = $this->clean('<svg xmlns="http://www.w3.org/2000/svg"><style>@\69mport "https://evil.test/a.css";</style><circle style="fill:\75 rl(https://evil.test/p)"/><rect width="1"/></svg>');

        self::assertStringNotContainsString('evil.test', $out);
        self::assertStringContainsString('<rect width="1"/>', $out);
    }

    /** Em UTF-16 a busca por `<!ENTITY` não acha nada: a recusa vem do byte nulo e do DTD já lido. */
    public function test_recusa_utf16_e_outras_codificacoes(): void
    {
        $svg = '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE svg [<!ENTITY a "x">]><svg xmlns="http://www.w3.org/2000/svg"><text>&a;</text></svg>';

        self::assertNull(SvgSanitizer::sanitize("\xFF\xFE".mb_convert_encoding($svg, 'UTF-16LE', 'UTF-8')));
        self::assertNull(SvgSanitizer::sanitize('<?xml version="1.0" encoding="ISO-8859-1"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="1"/></svg>'));
        self::assertNotNull(SvgSanitizer::sanitize('<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><rect width="1"/></svg>'));
    }
}
