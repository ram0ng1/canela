<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\BugReports;

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\BugReports\BugReport;
use Ramon\Canela\BugReports\ImageLinks;

/**
 * "Relatar problema" (`/api/canela-bug-reports`): quem tem a permissão
 * `canela.reportBugs` envia um relatório com a captura; o admin acompanha
 * todos, quem reportou só os próprios, e as capturas só saem para eles ou por
 * um link assinado.
 */
class BugReportsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');
        $this->setting('canela.bug_reports_enabled', '1');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outro', 'email' => 'outro@machine.local', 'is_email_confirmed' => 1],
            ],
        ]);
    }

    private function body($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    /** Uma captura PNG pequena, como o navegador manda. */
    private static function png(int $size = 4): string
    {
        $image = imagecreatetruecolor($size, $size);
        imagefill($image, 0, 0, imagecolorallocate($image, 200, 50, 50));
        ob_start();
        imagepng($image);

        return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
    }

    private function report(int $actor, array $overrides = [])
    {
        return $this->send($this->request('POST', '/api/canela-bug-reports', [
            'authenticatedAs' => $actor,
            'json' => ['data' => ['type' => 'canela-bug-reports', 'attributes' => array_merge([
                'kind' => 'content',
                'description' => 'O botão está cortado',
                'region' => self::png(),
                'full' => self::png(8),
                'context' => [
                    'url' => 'https://forum.local/d/1',
                    'title' => 'Tópico',
                    'viewport' => ['w' => 1280, 'h' => 800, 'dpr' => 2],
                ],
            ], $overrides)]],
        ]));
    }

    private function patch(int $actor, int $id, array $attributes)
    {
        return $this->send($this->request('PATCH', "/api/canela-bug-reports/$id", [
            'authenticatedAs' => $actor,
            'json' => ['data' => ['type' => 'canela-bug-reports', 'id' => (string) $id, 'attributes' => $attributes]],
        ]));
    }

    /** @return list<int> os ids da lista, na ordem */
    private function ids(array $body): array
    {
        return array_map('intval', array_column($body['data'], 'id'));
    }

    private function createdId($response): int
    {
        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        return (int) $this->body($response)['data']['id'];
    }

    /** Desligado (o padrão), todas as rotas respondem 404. */
    #[Test]
    public function desligado_por_padrao_responde_404(): void
    {
        $this->setting('canela.bug_reports_enabled', '0');

        $this->assertEquals(404, $this->report(2)->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-bug-reports', ['authenticatedAs' => 1]))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-bug-reports-export', ['authenticatedAs' => 1]))->getStatusCode());
        $this->assertNull($this->body($this->send($this->request('GET', '/api', ['authenticatedAs' => 2])))['data']['attributes']['canelaBugReports']);
    }

    /** As opções do botão chegam ao fórum só para quem pode reportar. */
    #[Test]
    public function opcoes_do_botao_so_para_quem_pode_reportar(): void
    {
        $this->setting('canela.bug_reports_console', '1');

        $guest = $this->body($this->send($this->request('GET', '/api')))['data']['attributes'];
        $member = $this->body($this->send($this->request('GET', '/api', ['authenticatedAs' => 2])))['data']['attributes'];

        $this->assertNull($guest['canelaBugReports']);
        $this->assertEquals(['button' => true, 'console' => true, 'full' => true], $member['canelaBugReports']);
    }

    /** Um membro envia o relatório: a captura é gravada e o contexto é limpo. */
    #[Test]
    public function membro_envia_relatorio(): void
    {
        $id = $this->createdId($this->report(2, [
            'kind' => 'inexistente',
            'context' => ['url' => 'javascript:alert(1)', 'title' => "Título\u{0007}", 'consoleErrors' => [['message' => 'x']]],
        ]));

        $report = BugReport::query()->find($id);

        $this->assertEquals(2, $report->user_id);
        $this->assertEquals('bug', $report->kind, 'tipo desconhecido vira "bug"');
        $this->assertEquals('open', $report->status);
        $this->assertEquals('', $report->url, 'só http(s) vale como endereço');
        $this->assertEquals('Título', $report->title);
        $this->assertEquals([], $report->context['consoleErrors'], 'console desligado no admin');
        $this->assertNotNull($report->region_path);
        $this->assertNotNull($report->full_path);
    }

    /** Sem descrição ou sem uma imagem válida: 422, nada gravado. */
    #[Test]
    public function validacao_do_relatorio(): void
    {
        $this->assertEquals(422, $this->report(2, ['description' => '   '])->getStatusCode());
        $this->assertEquals(422, $this->report(2, ['region' => 'data:image/gif;base64,R0lGOD'])->getStatusCode());
        $this->assertEquals(422, $this->report(2, ['region' => 'data:image/png;base64,'.base64_encode('não é png')])->getStatusCode());
        $this->assertEquals(0, BugReport::query()->count());
    }

    /** Sem a permissão `canela.reportBugs`, o envio é recusado (403). */
    #[Test]
    public function sem_permissao_nao_reporta(): void
    {
        $this->app();
        $this->database()->table('group_permission')->where('permission', 'canela.reportBugs')->delete();

        $this->assertEquals(403, $this->report(2)->getStatusCode());
        $this->assertNull($this->body($this->send($this->request('GET', '/api', ['authenticatedAs' => 2])))['data']['attributes']['canelaBugReports']);
    }

    /** Visitante não lista os relatórios: 401. */
    #[Test]
    public function visitante_nao_acessa(): void
    {
        $this->assertEquals(401, $this->send($this->request('GET', '/api/canela-bug-reports'))->getStatusCode());
    }

    /** Mais de 10 relatórios na hora: 422 (o admin não tem teto). */
    #[Test]
    public function limite_por_hora(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->createdId($this->report(2));
        }

        $this->assertEquals(422, $this->report(2)->getStatusCode());
        $this->createdId($this->report(1));
    }

    /** Cada um lista só os próprios; o admin lista todos, com quem enviou e as contagens. */
    #[Test]
    public function listagem_do_usuario_e_do_admin(): void
    {
        $mine = $this->createdId($this->report(2));
        $this->createdId($this->report(3));

        $user = $this->body($this->send($this->request('GET', '/api/canela-bug-reports', ['authenticatedAs' => 2])));

        $this->assertSame([$mine], $this->ids($user));
        $this->assertArrayNotHasKey('user', $user['data'][0]['relationships'] ?? []);
        $this->assertArrayNotHasKey('context', $user['data'][0]['attributes']);

        $admin = $this->body($this->send($this->request('GET', '/api/canela-bug-reports', ['authenticatedAs' => 1])->withQueryParams(['include' => 'user'])));

        $this->assertEquals(2, $admin['meta']['page']['total']);
        $this->assertEquals(['open' => 2], $admin['meta']['counts']);
        $this->assertArrayHasKey('context', $admin['data'][0]['attributes']);

        $sender = $admin['data'][0]['relationships']['user']['data']['id'];
        $users = array_column(array_filter($admin['included'], static fn (array $item) => $item['type'] === 'users'), 'attributes', 'id');
        $this->assertEquals('outro', $users[$sender]['username']);
    }

    /** O filtro de status do admin: `active` deixa de fora os resolvidos. */
    #[Test]
    public function filtro_de_status(): void
    {
        $fixed = $this->createdId($this->report(2));
        $open = $this->createdId($this->report(2));
        $this->assertEquals(200, $this->patch(1, $fixed, ['status' => 'fixed'])->getStatusCode());

        $active = $this->body($this->send($this->request('GET', '/api/canela-bug-reports', ['authenticatedAs' => 1])->withQueryParams(['filter' => ['status' => 'active']])));
        $done = $this->body($this->send($this->request('GET', '/api/canela-bug-reports', ['authenticatedAs' => 1])->withQueryParams(['filter' => ['status' => 'fixed']])));

        $this->assertSame([$open], $this->ids($active));
        $this->assertSame([$fixed], $this->ids($done));
        // As contagens das abas não dependem do filtro de status.
        $this->assertEquals(['open' => 1, 'fixed' => 1], $active['meta']['counts']);
    }

    /** O relatório de outra pessoa responde como inexistente (404). */
    #[Test]
    public function relatorio_alheio_responde_404(): void
    {
        $id = $this->createdId($this->report(3));

        $this->assertEquals(404, $this->send($this->request('GET', "/api/canela-bug-reports/$id", ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(200, $this->send($this->request('GET', "/api/canela-bug-reports/$id", ['authenticatedAs' => 3]))->getStatusCode());

        $admin = $this->body($this->send($this->request('GET', "/api/canela-bug-reports/$id", ['authenticatedAs' => 1])));

        $this->assertArrayHasKey('context', $admin['data']['attributes']);
    }

    /** Só o admin muda status e nota; um status desconhecido é recusado (422) e nada muda. */
    #[Test]
    public function so_admin_atualiza(): void
    {
        $id = $this->createdId($this->report(2));

        $owner = $this->patch(2, $id, ['status' => 'fixed']);

        $this->assertEquals(403, $owner->getStatusCode());
        $this->assertEquals('open', BugReport::query()->find($id)->status);

        $admin = $this->patch(1, $id, ['status' => 'in_progress', 'note' => 'Vendo isso']);

        $this->assertEquals(200, $admin->getStatusCode());
        $this->assertEquals('in_progress', $this->body($admin)['data']['attributes']['status']);
        $this->assertEquals('Vendo isso', $this->body($admin)['data']['attributes']['note']);

        $this->assertEquals(422, $this->patch(1, $id, ['status' => 'hackeado'])->getStatusCode());

        $this->assertEquals('in_progress', BugReport::query()->find($id)->status);
    }

    /** Só o admin apaga, e as capturas vão junto. */
    #[Test]
    public function so_admin_apaga(): void
    {
        $id = $this->createdId($this->report(2));

        $this->assertEquals(403, $this->send($this->request('DELETE', "/api/canela-bug-reports/$id", ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(204, $this->send($this->request('DELETE', "/api/canela-bug-reports/$id", ['authenticatedAs' => 1]))->getStatusCode());
        $this->assertNull(BugReport::query()->find($id));
        $this->assertEquals(404, $this->send($this->request('GET', "/api/canela-bug-reports/$id/region", ['authenticatedAs' => 1]))->getStatusCode());
    }

    /** A captura sai em WebP para quem reportou e para o admin; para os outros, 404. */
    #[Test]
    public function captura_so_para_dono_e_admin(): void
    {
        $id = $this->createdId($this->report(2));

        $owner = $this->send($this->request('GET', "/api/canela-bug-reports/$id/region", ['authenticatedAs' => 2]));

        $this->assertEquals(200, $owner->getStatusCode());
        $this->assertEquals('image/webp', $owner->getHeaderLine('Content-Type'));
        $this->assertStringStartsWith('private', $owner->getHeaderLine('Cache-Control'));
        $this->assertStringStartsWith('RIFF', (string) $owner->getBody());

        $this->assertEquals(200, $this->send($this->request('GET', "/api/canela-bug-reports/$id/full", ['authenticatedAs' => 1]))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', "/api/canela-bug-reports/$id/region", ['authenticatedAs' => 3]))->getStatusCode());
        $this->assertEquals(401, $this->send($this->request('GET', "/api/canela-bug-reports/$id/region"))->getStatusCode());
    }

    /**
     * O link assinado das instruções da IA abre a captura sem login; uma
     * assinatura errada, de outra captura ou vencida não abre.
     */
    #[Test]
    public function link_assinado_abre_sem_login(): void
    {
        $id = $this->createdId($this->report(2));

        /** @var ImageLinks $links */
        $links = $this->app()->getContainer()->make(ImageLinks::class);
        $query = $links->query($id, 'region');
        parse_str(ltrim($query, '?'), $params);

        $signed = $this->send($this->request('GET', "/api/canela-bug-reports/$id/region")->withQueryParams($params));

        $this->assertEquals(200, $signed->getStatusCode());
        $this->assertEquals('image/webp', $signed->getHeaderLine('Content-Type'));

        $otherImage = $this->send($this->request('GET', "/api/canela-bug-reports/$id/full")->withQueryParams($params));
        $forged = $this->send($this->request('GET', "/api/canela-bug-reports/$id/region")->withQueryParams(['exp' => $params['exp'], 'sig' => str_repeat('0', 64)]));

        $expiredAt = time() - 10;
        $expired = $this->send($this->request('GET', "/api/canela-bug-reports/$id/region")->withQueryParams([
            'exp' => $expiredAt,
            'sig' => ImageLinks::signature((string) $this->database()->table('settings')->where('key', ImageLinks::SECRET)->value('value'), $id, 'region', $expiredAt),
        ]));

        $this->assertEquals(401, $otherImage->getStatusCode());
        $this->assertEquals(401, $forged->getStatusCode());
        $this->assertEquals(401, $expired->getStatusCode());
    }

    /** As instruções para a IA (Markdown) são só do admin, com os links assinados. */
    #[Test]
    public function exportacao_so_para_o_admin(): void
    {
        $id = $this->createdId($this->report(2));

        $this->assertEquals(403, $this->send($this->request('GET', '/api/canela-bug-reports-export', ['authenticatedAs' => 2]))->getStatusCode());

        $all = $this->send($this->request('GET', '/api/canela-bug-reports-export', ['authenticatedAs' => 1])->withQueryParams(['download' => '1']));

        $this->assertEquals(200, $all->getStatusCode());
        $this->assertStringStartsWith('text/markdown', $all->getHeaderLine('Content-Type'));
        $this->assertStringContainsString('attachment;', $all->getHeaderLine('Content-Disposition'));
        $this->assertStringContainsString('O botão está cortado', (string) $all->getBody());
        $this->assertStringContainsString("/canela-bug-reports/$id/region?exp=", (string) $all->getBody());

        $one = $this->send($this->request('GET', "/api/canela-bug-reports/$id/prompt", ['authenticatedAs' => 1]));

        $this->assertEquals(200, $one->getStatusCode());
        $this->assertEquals(403, $this->send($this->request('GET', "/api/canela-bug-reports/$id/prompt", ['authenticatedAs' => 2]))->getStatusCode());
    }
    /**
     * A policy: quem reportou e o admin veem; só o admin muda, apaga e
     * exporta (também sem um relatório, para a exportação de todos).
     */
    #[Test]
    public function policy_dos_relatorios(): void
    {
        $id = $this->createdId($this->report(2));

        $report = BugReport::query()->findOrFail($id);
        $admin = User::query()->findOrFail(1);
        $owner = User::query()->findOrFail(2);
        $other = User::query()->findOrFail(3);

        $this->assertTrue($owner->can('view', $report));
        $this->assertFalse($other->can('view', $report));
        $this->assertTrue($admin->can('view', $report));

        foreach (['edit', 'delete', 'export'] as $ability) {
            $this->assertTrue($admin->can($ability, $report), $ability);
            $this->assertFalse($owner->can($ability, $report), $ability);
        }

        $this->assertTrue($admin->can('export', BugReport::class));
        $this->assertFalse($owner->can('export', BugReport::class));

        $this->assertSame([$id], BugReport::whereVisibleTo($owner)->pluck('id')->all());
        $this->assertSame([], BugReport::whereVisibleTo($other)->pluck('id')->all());
    }

    /**
     * A validação dos campos: descrição e textos com teto, a captura
     * obrigatória e, ao enviar, nada de status nem nota (são do admin).
     */
    #[Test]
    public function validacao_dos_campos(): void
    {
        $this->assertEquals(422, $this->report(2, ['description' => str_repeat('a', 4001)])->getStatusCode());
        $this->assertEquals(422, $this->report(2, ['currentText' => str_repeat('a', 2001)])->getStatusCode());
        $this->assertEquals(422, $this->report(2, ['region' => null])->getStatusCode());
        $this->assertEquals(403, $this->report(2, ['status' => 'fixed'])->getStatusCode());
        $this->assertEquals(403, $this->report(2, ['note' => 'Já resolvido'])->getStatusCode());
        $this->assertEquals(0, BugReport::query()->count());

        $id = $this->createdId($this->report(2));

        $this->assertEquals(422, $this->patch(1, $id, ['note' => str_repeat('a', 2001)])->getStatusCode());
        // Depois de enviado, o texto não muda (nem pelo admin).
        $this->assertEquals(403, $this->patch(1, $id, ['description' => 'Outro texto'])->getStatusCode());
        $this->assertEquals('O botão está cortado', BugReport::query()->find($id)->description);
    }

    /** A captura inteira desligada no admin fica de fora, mesmo enviada. */
    #[Test]
    public function captura_inteira_desligada_fica_de_fora(): void
    {
        $this->setting('canela.bug_reports_full', '0');

        $id = $this->createdId($this->report(2));

        $this->assertNull(BugReport::query()->find($id)->full_path);
        $this->assertFalse($this->body($this->send($this->request('GET', "/api/canela-bug-reports/$id", ['authenticatedAs' => 2])))['data']['attributes']['hasFull']);
    }

    /** `filter[mine]`: o admin vê só os que ele mesmo enviou. */
    #[Test]
    public function admin_filtra_os_proprios(): void
    {
        $this->createdId($this->report(2));
        $own = $this->createdId($this->report(1));

        $mine = $this->body($this->send($this->request('GET', '/api/canela-bug-reports', ['authenticatedAs' => 1])->withQueryParams(['filter' => ['mine' => '1']])));

        $this->assertSame([$own], $this->ids($mine));
        $this->assertEquals(['open' => 1], $mine['meta']['counts']);
    }

    /** As instruções de um relatório alheio: para quem não é admin, nem existe (404). */
    #[Test]
    public function instrucoes_de_relatorio_alheio(): void
    {
        $id = $this->createdId($this->report(2));

        $this->assertEquals(404, $this->send($this->request('GET', "/api/canela-bug-reports/$id/prompt", ['authenticatedAs' => 3]))->getStatusCode());
        $this->assertStringContainsString('O botão está cortado', (string) $this->send($this->request('GET', "/api/canela-bug-reports/$id/prompt", ['authenticatedAs' => 1]))->getBody());
    }
}
