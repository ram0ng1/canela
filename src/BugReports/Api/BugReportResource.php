<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\BugReports\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Http\Exception\RouteNotFoundException;
use Illuminate\Database\Eloquent\Builder;
use Laminas\Diactoros\Response\TextResponse;
use Ramon\Canela\BugReports\Access\BugReportPolicy;
use Ramon\Canela\BugReports\BugReport;
use Ramon\Canela\BugReports\BugReportImages;
use Ramon\Canela\BugReports\BugReportService;
use Ramon\Canela\BugReports\BugReportsSettings;
use Ramon\Canela\BugReports\PromptBuilder;
use Tobyz\JsonApiServer\Context as OriginalContext;
use Tobyz\JsonApiServer\Pagination\OffsetPagination;
use Tobyz\JsonApiServer\Pagination\Pagination;

/**
 * `/api/canela-bug-reports`: o "Relatar problema".
 *
 * - GET lista: a administração vê todos, os demais só os próprios (o escopo,
 *   ScopeBugReportVisibility). Filtros `status` (um status ou `active`, os
 *   que pedem atenção) e `mine`; 20 por página, do mais novo ao mais antigo,
 *   com `meta.counts` (quantos por status, antes do filtro de status) e
 *   `meta.page.total`.
 * - POST envia um relatório, com a permissão `canela.reportBugs` e no máximo
 *   BugReportService::PER_HOUR por hora (o admin não tem teto).
 * - GET/PATCH/DELETE /{id}: ver (quem reportou ou o admin), mudar status e
 *   nota e apagar com as capturas (só o admin, BugReportPolicy).
 * - GET /{id}/prompt: as instruções para a IA de um relatório, em Markdown.
 *
 * O contexto da página e quem enviou só aparecem para a administração. O
 * relatório de outra pessoa responde 404. Com o recurso desligado, 404.
 *
 * As capturas (`region`, `full`) chegam como `data:` URL e nunca voltam pela
 * API JSON: saem pelo ReportImageController, que confere quem pede.
 *
 * @extends AbstractDatabaseResource<BugReport>
 */
final class BugReportResource extends AbstractDatabaseResource
{
    private const PER_PAGE = 20;

    private const MAX_TEXT = 2000;

    /**
     * Os bytes das capturas de um relatório ainda não gravado: chegam pelos
     * campos e só vão para o disco no `creating()`, que os esquece. A chave é
     * o `spl_object_id` do modelo novo.
     *
     * @var array<int, array<string, string|null>>
     */
    private array $pendingImages = [];

    public function __construct(
        private readonly BugReportsSettings $settings,
        private readonly BugReportService $reports,
        private readonly BugReportImages $images,
        private readonly PromptBuilder $prompts,
    ) {
    }

    #[\Override]
    public function type(): string
    {
        return 'canela-bug-reports';
    }

    #[\Override]
    public function model(): string
    {
        return BugReport::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    #[\Override]
    public function endpoints(): array
    {
        $assertEnabled = function (): void {
            if (! $this->settings->enabled()) {
                throw new RouteNotFoundException();
            }
        };

        return [
            Endpoint\Index::make()
                ->authenticated()
                ->before($assertEnabled)
                ->paginate(self::PER_PAGE, self::PER_PAGE)
                // Sem um searcher, o core recusa qualquer `filter[...]`; os
                // filtros daqui são simples o bastante para morar no recurso.
                ->query(function (Builder $query, ?Pagination $pagination, Context $context, array $filters): Context {
                    if (! empty($filters['mine'])) {
                        $query->where('canela_bug_reports.user_id', $context->getActor()->id);
                    }

                    // As contagens das abas do painel: antes do filtro de status.
                    $counts = (clone $query)->toBase()
                        ->selectRaw('status, count(*) as total')
                        ->groupBy('status')
                        ->pluck('total', 'status')
                        ->map(static fn ($n): int => (int) $n)
                        ->all();

                    $status = is_string($filters['status'] ?? null) ? $filters['status'] : '';

                    if ($status === 'active') {
                        $query->whereNotIn('canela_bug_reports.status', ['fixed', 'wontfix']);
                    } elseif (in_array($status, BugReport::STATUSES, true)) {
                        $query->where('canela_bug_reports.status', $status);
                    }

                    $query->orderByDesc('canela_bug_reports.id');

                    if ($pagination instanceof OffsetPagination) {
                        $pagination->apply($query);
                    }

                    return $context->withQuery($query)->withInternal('canela.bug_report_counts', $counts);
                })
                ->meta([
                    Schema\Arr::make('counts')
                        ->get(static fn (Context $context) => (object) $context->internal('canela.bug_report_counts', [])),
                ]),
            Endpoint\Show::make()
                ->authenticated()
                ->can('view')
                ->before($assertEnabled),
            Endpoint\Create::make()
                ->authenticated()
                ->can(BugReportsSettings::PERMISSION)
                ->before($assertEnabled),
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit')
                ->before($assertEnabled),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->before($assertEnabled),
            // Texto para colar numa IA, e não JSON: a resposta é o Markdown.
            Endpoint\Endpoint::make('prompt')
                ->route('GET', '/{id}/prompt')
                ->authenticated()
                ->can('export')
                ->action(function (Context $context) use ($assertEnabled): BugReport {
                    $assertEnabled();

                    /** @var BugReport $report */
                    $report = $context->model;

                    return $report;
                })
                ->response(fn (Context $context, BugReport $report) => new TextResponse(
                    $this->prompts->build([$report]),
                    200,
                    ['Content-Type' => 'text/markdown; charset=utf-8', 'Cache-Control' => 'no-store'],
                )),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $forAdmin = static fn (BugReport $report, Context $context) => BugReportPolicy::manages($context->getActor());
        $onCreate = static fn (BugReport $report, Context $context) => $context->creating();
        $onUpdate = static fn (BugReport $report, Context $context) => $context->updating();

        return [
            // Um tipo desconhecido vira "bug": o relatório chega mesmo assim.
            Schema\Str::make('kind')
                ->writable($onCreate)
                ->set(static fn (BugReport $report, ?string $value) => $report->kind = in_array($value, BugReport::KINDS, true) ? $value : 'bug'),
            Schema\Str::make('status')
                ->writable($onUpdate)
                ->in(BugReport::STATUSES),
            Schema\Str::make('description')
                ->writable($onCreate)
                // `required` apara o texto antes de conferir: "   " não passa.
                ->requiredOnCreate()
                ->maxLength(BugReportService::MAX_DESCRIPTION)
                ->validationMessages(['description.required' => $this->reports->message('description_required')])
                ->set(static fn (BugReport $report, string $value) => $report->description = BugReportService::text($value, BugReportService::MAX_DESCRIPTION)),
            Schema\Str::make('currentText')
                ->nullable()
                ->writable($onCreate)
                ->maxLength(self::MAX_TEXT)
                ->set(static fn (BugReport $report, ?string $value) => $report->current_text = BugReportService::text($value, self::MAX_TEXT) ?: null),
            Schema\Str::make('suggestedText')
                ->nullable()
                ->writable($onCreate)
                ->maxLength(self::MAX_TEXT)
                ->set(static fn (BugReport $report, ?string $value) => $report->suggested_text = BugReportService::text($value, self::MAX_TEXT) ?: null),
            Schema\Str::make('url'),
            Schema\Str::make('title'),
            // A resposta da equipe para quem reportou.
            Schema\Str::make('note')
                ->property('admin_note')
                ->nullable()
                ->writable($onUpdate)
                ->maxLength(self::MAX_TEXT)
                ->set(static fn (BugReport $report, ?string $value) => $report->admin_note = BugReportService::text($value, self::MAX_TEXT) ?: null),
            Schema\Boolean::make('hasFull')
                ->get(static fn (BugReport $report) => $report->full_path !== null),
            // A captura da área marcada: obrigatória e num formato de imagem
            // aceito; se os bytes são mesmo uma imagem, só ao gravar.
            Schema\Str::make('region')
                ->visible(false)
                ->writable($onCreate)
                ->requiredOnCreate()
                ->rule(fn () => function (string $attribute, mixed $value, \Closure $fail): void {
                    if (BugReportImages::decodeDataUrl($value) === null) {
                        $fail($this->reports->message('image_invalid'));
                    }
                })
                ->set(fn (BugReport $report, string $value) => $this->hold($report, 'region', BugReportImages::decodeDataUrl($value))),
            // A tela inteira é opcional: inválida ou desligada no admin, fica de fora.
            Schema\Str::make('full')
                ->visible(false)
                ->nullable()
                ->writable($onCreate)
                ->set(fn (BugReport $report, ?string $value) => $this->hold($report, 'full', $this->reports->wantsFull() ? BugReportImages::decodeDataUrl($value) : null)),
            Schema\Arr::make('context')
                ->nullable()
                ->visible($forAdmin)
                ->writable($onCreate)
                ->set(fn (BugReport $report, ?array $value) => $this->applyContext($report, $value)),
            Schema\DateTime::make('createdAt'),
            Schema\DateTime::make('updatedAt'),
            Schema\Relationship\ToOne::make('user')
                ->type('users')
                ->visible($forAdmin)
                ->includable(),
        ];
    }

    /**
     * O dono é sempre quem envia. O teto por hora é conferido antes de gravar
     * as capturas, para um pedido recusado não deixar arquivo no disco.
     */
    #[\Override]
    public function creating(object $model, OriginalContext $context): object
    {
        /** @var BugReport $model */
        $actor = $context->getActor();
        $pending = $this->pendingImages[spl_object_id($model)] ?? [];
        unset($this->pendingImages[spl_object_id($model)]);

        if (! $actor->isAdmin() && $this->reports->overLimit((int) $actor->id)) {
            $this->reports->fail('description', 'too_many');
        }

        $regionPath = $this->reports->storeImage($pending['region'] ?? '');

        if ($regionPath === null) {
            $this->reports->fail('region', 'image_invalid');
        }

        if ($model->context === null) {
            $this->applyContext($model, null);
        }

        $model->user_id = (int) $actor->id;
        $model->kind ??= 'bug';
        $model->status = 'open';
        $model->region_path = $regionPath;
        $model->full_path = ($pending['full'] ?? null) !== null ? $this->reports->storeImage($pending['full']) : null;

        return $model;
    }

    /** As capturas vão junto com o relatório. */
    #[\Override]
    public function deleting(object $model, OriginalContext $context): void
    {
        /** @var BugReport $model */
        $this->images->delete($model->region_path);
        $this->images->delete($model->full_path);

        parent::deleting($model, $context);
    }

    /** Guarda os bytes de uma captura até o `creating()`. */
    private function hold(BugReport $report, string $which, ?string $bytes): void
    {
        $this->pendingImages[spl_object_id($report)][$which] = $bytes;
    }

    /** O contexto limpo, com a URL e o título da página tirados dele. */
    private function applyContext(BugReport $report, ?array $raw): void
    {
        $context = $this->reports->cleanContext($raw);

        $report->context = $context;
        $report->url = BugReportService::text($context['url'] ?? '', 1000);
        $report->title = BugReportService::text($context['title'] ?? '', 200);
    }
}
