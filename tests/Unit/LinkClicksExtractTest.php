<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\Unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Links\LinkClicks;

/**
 * Os links saem do XML da postagem: o clique só é gravado se o endereço está
 * ali, e o mapa do tópico lista o que sai daqui.
 */
final class LinkClicksExtractTest extends TestCase
{
    public function test_link_solto_tem_texto_vazio(): void
    {
        $xml = '<r><p>veja <URL url="https://example.com/b">https://example.com/b</URL></p></r>';

        self::assertSame([['url' => 'https://example.com/b', 'text' => '']], LinkClicks::extract($xml));
    }

    public function test_link_markdown_tira_os_marcadores(): void
    {
        $xml = '<r><p><URL url="https://example.com/docs?a=1&amp;b=2"><s>[</s>Documentação<e>](https://example.com/docs?a=1&amp;b=2)</e></URL></p></r>';

        self::assertSame([['url' => 'https://example.com/docs?a=1&b=2', 'text' => 'Documentação']], LinkClicks::extract($xml));
    }

    /**
     * O s9e põe os atributos em ordem alfabética: com título, o `url` vem
     * depois do `title`. Antes estes links sumiam (o clique não contava).
     */
    public function test_link_com_titulo(): void
    {
        $xml = '<r><p><URL title="Título &quot;x&quot; url=&quot;y" url="https://example.com/a"><s>[</s>doc<e>](https://example.com/a "Título")</e></URL></p></r>';

        self::assertSame([['url' => 'https://example.com/a', 'text' => 'doc']], LinkClicks::extract($xml));
    }

    public function test_varios_links_na_ordem(): void
    {
        $xml = '<r><p><URL url="https://a.test/">a</URL> e <URL title="t" url="https://b.test/">b</URL> e <URL url="https://c.test/"><s>&lt;</s>https://c.test/<e>&gt;</e></URL></p></r>';

        self::assertSame(['https://a.test/', 'https://b.test/', 'https://c.test/'], array_column(LinkClicks::extract($xml), 'url'));
    }

    public function test_sem_links(): void
    {
        self::assertSame([], LinkClicks::extract(null));
        self::assertSame([], LinkClicks::extract('<t>texto</t>'));
        // Um elemento que só começa com URL não é link.
        self::assertSame([], LinkClicks::extract('<r><URLX url="https://x.test">x</URLX></r>'));
    }
}
