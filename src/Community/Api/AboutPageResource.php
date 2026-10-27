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

namespace Ramon\Canela\Community\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Serializer;
use Flarum\Foundation\ValidationException;
use FoF\Pages\Page;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Community\AboutPages;
use Ramon\Canela\Community\GuidelinesPage;
use Tobyz\JsonApiServer\Context as OriginalContext;

use function Tobyz\JsonApiServer\json_api_response;

/**
 * `/api/canela-about-pages`: as páginas do fof/pages que aparecem na área
 * Sobre.
 *
 * - GET /{id}: uma das abas extras, com o HTML, o título e o rótulo da aba.
 *   Só responde pelas páginas da lista do admin, e com a visibilidade do
 *   próprio fof/pages; qualquer outra — ou sem o fof/pages, ou com o Sobre
 *   desligado — é 404, para o endpoint não virar um jeito de ler páginas fora
 *   da área.
 * - POST /guidelines (só o admin): cria a página "Diretrizes" com o texto
 *   atual das diretrizes do tema e a escolhe para o /guidelines (201); com uma
 *   já escolhida e existente, devolve ela (200). Sem o fof/pages, 422.
 *
 * O tipo não é o `pages` do fof/pages: aqui a página sai com o HTML pronto e
 * o rótulo da aba, e só a parte da área Sobre.
 *
 * @extends AbstractDatabaseResource<Page>
 */
final class AboutPageResource extends AbstractDatabaseResource
{
    public function __construct(
        private readonly AboutPages $pages,
        private readonly GuidelinesPage $guidelines,
    ) {
    }

    #[\Override]
    public function type(): string
    {
        return 'canela-about-pages';
    }

    #[\Override]
    public function model(): string
    {
        return Page::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    /**
     * Só as abas da lista do admin, e só com o fof/pages ligado (sem ele, nem
     * a tabela existe): o resto não existe aqui.
     */
    #[\Override]
    public function find(string $id, OriginalContext $context): ?object
    {
        $page = ctype_digit($id) ? $this->pages->find($context->getActor(), (int) $id) : null;

        return $page instanceof Page ? $page : null;
    }

    #[\Override]
    public function endpoints(): array
    {
        return [
            Endpoint\Show::make()
                ->can('viewForum'),
            Endpoint\Endpoint::make('guidelines')
                ->route('POST', '/guidelines')
                ->admin()
                ->action(function (Context $context): array {
                    if (! $this->guidelines->available()) {
                        throw new ValidationException(['fof-pages' => 'fof/pages is not enabled.']);
                    }

                    return $this->guidelines->create($context->getActor());
                })
                ->response(function (Context $context, array $result) {
                    // 201 só quando a página nasceu agora; a já escolhida volta com 200.
                    return json_api_response($this->document($context, $result['page']))
                        ->withStatus($result['created'] ? 201 : 200);
                }),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        return [
            Schema\Str::make('title'),
            // O rótulo da aba: o do admin, ou o título da página.
            Schema\Str::make('label')
                ->get(fn (Page $page) => $this->pages->label($page)),
            Schema\Str::make('html')
                ->get(fn (Page $page) => $this->pages->html($page)),
        ];
    }

    /** @return array<string, mixed> */
    private function document(Context $context, Page $page): array
    {
        $serializer = new Serializer($context);
        $serializer->addPrimary($context->resource($this->type()), $page, []);

        [$data] = $serializer->serialize();

        return ['data' => $data[0]];
    }
}
