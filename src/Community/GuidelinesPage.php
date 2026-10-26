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

namespace Ramon\Canela\Community;

use Flarum\Extension\ExtensionManager;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Illuminate\Contracts\Events\Dispatcher;
use FoF\Pages\Events\PageCreated;
use FoF\Pages\Page;
use FoF\Pages\Util\Html;

/**
 * As Diretrizes como uma página do fof/pages: qual página é (setting
 * `canela.guidelines_page`), o conteúdo dela e a criação da página com o
 * texto atual. Nada aqui roda sem o fof/pages habilitado.
 */
final class GuidelinesPage
{
    private const SLUG = 'guidelines';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
        private readonly TranslatorInterface $translator,
        private readonly Dispatcher $events,
    ) {
    }

    public function available(): bool
    {
        return $this->extensions->isEnabled('fof-pages') && class_exists(Page::class);
    }

    /**
     * Há diretrizes para o ator: o texto do admin, ou a página do fof/pages
     * escolhida e visível para ele. Sem isso o /guidelines responde 404
     * (ShowGuidelinesController), e o link "Diretrizes" não pode aparecer —
     * por isso a página oculta ou restrita conta com a visibilidade do
     * próprio fof/pages, e não só com a existência.
     */
    public function hasContent(User $actor): bool
    {
        if (trim((string) $this->settings->get(Community::GUIDELINES_TEXT)) !== '') {
            return true;
        }

        return $this->find($actor) !== null;
    }

    /** A página escolhida, se existir e o ator puder vê-la. */
    public function find(User $actor): ?Page
    {
        $id = (int) $this->settings->get(Community::GUIDELINES_PAGE);

        if ($id <= 0 || ! $this->available()) {
            return null;
        }

        $page = Page::query()->whereVisibleTo($actor)->find($id);

        return $page instanceof Page ? $page : null;
    }

    public function html(Page $page): string
    {
        return Html::render($page->content_html, $page);
    }

    /** A página já escolhida no admin, se ainda existir (sem visibilidade: é para o admin). */
    public function configured(): ?Page
    {
        $id = (int) $this->settings->get(Community::GUIDELINES_PAGE);

        if ($id <= 0 || ! $this->available()) {
            return null;
        }

        $page = Page::query()->find($id);

        return $page instanceof Page ? $page : null;
    }

    /**
     * Cria a página "Diretrizes" no fof/pages com o texto atual das
     * diretrizes do tema (o do admin, ou o padrão) e a escolhe.
     *
     * Idempotente: se a página escolhida ainda existe, ela volta como está —
     * clicar duas vezes no botão do admin não cria duas. O endereço é o
     * primeiro livre entre `guidelines`, `guidelines-2`… (o slug é único no
     * fof/pages), e sai o PageCreated, como quando a página é criada pelo
     * próprio fof/pages, para as extensões que o escutam.
     *
     * @return array{page: Page, created: bool}
     */
    public function create(User $actor): array
    {
        if ($existing = $this->configured()) {
            return ['page' => $existing, 'created' => false];
        }

        $custom = trim((string) $this->settings->get(Community::GUIDELINES_TEXT));

        $page = new Page();
        $page->title = $this->translator->trans('ramon-canela.forum.community.guidelines.title');
        $page->slug = $this->uniqueSlug(self::SLUG);
        $page->content = $custom !== '' ? $custom : $this->defaultMarkdown();
        $page->is_hidden = false;
        $page->is_restricted = false;
        $page->is_html = false;
        $page->save();

        $this->settings->set(Community::GUIDELINES_PAGE, (string) $page->id);

        $this->events->dispatch(new PageCreated($page, $actor));

        return ['page' => $page, 'created' => true];
    }

    private function uniqueSlug(string $base): string
    {
        $slug = $base;

        for ($i = 2; Page::query()->where('slug', $slug)->exists(); $i++) {
            $slug = "$base-$i";
        }

        return $slug;
    }

    /** O texto padrão do tema, no idioma do fórum. */
    public function defaultMarkdown(): string
    {
        $locale = $this->translator->getLocale();
        $file = str_starts_with(strtolower($locale), 'en') ? 'en' : 'pt-BR';

        return (string) @file_get_contents(__DIR__.'/Content/guidelines/'.$file.'.md');
    }
}
