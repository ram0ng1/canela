<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Templates\TemplateFields;
use Ramon\Canela\Templates\TemplateIndex;

/**
 * Os campos de um modelo de formulário vêm do texto ({{campo}}): na ordem do
 * texto, sem repetir, só com a configuração conhecida (e cortada no tamanho);
 * o que não está no texto sai. E o índice que o fórum recebe em toda página
 * só aceita entradas com a forma esperada.
 */
final class TemplateFieldsTest extends TestCase
{
    public function test_campos_vem_do_texto_na_ordem_e_sem_repetir(): void
    {
        $body = "**Versão:** {{Versão}}\n\n{{ Descrição }}\n\nDe novo: {{Versão}}, {{}} e {{ }} e {{".str_repeat('a', 61)."}}";

        self::assertSame(['Versão', 'Descrição'], TemplateFields::placeholders($body));
        self::assertSame([], TemplateFields::placeholders('sem campo nenhum, nem {chave simples}'));
    }

    public function test_normaliza_a_configuracao_e_descarta_o_que_nao_esta_no_texto(): void
    {
        $fields = TemplateFields::normalize([
            ['key' => 'Descrição', 'label' => '  O que aconteceu ', 'type' => 'textarea', 'required' => 'true', 'placeholder' => str_repeat('x', 600), 'extra' => 'fora'],
            ['key' => 'Versão', 'type' => 'select', 'options' => [' 2.0 ', '2.0', '', 3, ['x']], 'required' => false],
            ['key' => 'Sumiu', 'label' => 'não está no texto'],
            'lixo',
        ], '{{Versão}} {{Descrição}}');

        self::assertSame(['Versão', 'Descrição'], array_column($fields, 'key'));

        self::assertSame('select', $fields[0]['type']);
        self::assertSame(['2.0', '3'], $fields[0]['options']);
        self::assertFalse($fields[0]['required']);

        self::assertSame('O que aconteceu', $fields[1]['label']);
        self::assertSame('textarea', $fields[1]['type']);
        self::assertTrue($fields[1]['required']);
        self::assertSame(TemplateFields::MAX_TEXT, mb_strlen($fields[1]['placeholder']));
        self::assertSame([], $fields[1]['options']);
        self::assertArrayNotHasKey('extra', $fields[1]);
    }

    public function test_tipo_desconhecido_vira_texto_e_rotulo_vazio_vira_a_chave(): void
    {
        self::assertSame(
            [['key' => 'Campo', 'label' => 'Campo', 'type' => 'text', 'placeholder' => '', 'description' => '', 'required' => false, 'options' => []]],
            TemplateFields::normalize([['key' => 'Campo', 'type' => 'upload', 'label' => '   ']], '{{Campo}}')
        );
    }

    public function test_sem_configuracao_cada_campo_do_texto_ganha_o_padrao(): void
    {
        self::assertSame(['A', 'B'], array_column(TemplateFields::normalize(null, '{{A}} {{B}}'), 'key'));
        self::assertSame([], TemplateFields::normalize([['key' => 'A']], 'sem campos'));
    }

    public function test_indice_so_aceita_a_forma_esperada(): void
    {
        self::assertSame([], TemplateIndex::decode(null));
        self::assertSame([], TemplateIndex::decode(''));
        self::assertSame([], TemplateIndex::decode('{nao é json'));
        self::assertSame([], TemplateIndex::decode('"texto"'));

        $index = TemplateIndex::decode((string) json_encode([
            ['id' => '3', 'name' => 'Suporte', 'kind' => 'form', 'required' => 1, 'tags' => ['5', 7, 'x']],
            ['id' => 4, 'name' => 'Livre', 'kind' => 'outro'],
            ['name' => 'sem id'],
            'lixo',
        ]));

        self::assertSame([
            ['id' => 3, 'name' => 'Suporte', 'kind' => 'form', 'required' => true, 'tags' => [5, 7]],
            ['id' => 4, 'name' => 'Livre', 'kind' => 'text', 'required' => false, 'tags' => []],
        ], $index);
    }
}
