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
use FoF\Pages\Page;
use FoF\Pages\Util\Html;

/**
 * As Diretrizes como uma página do fof/pages: qual página é (setting
 * `canela.guidelines_page`), o conteúdo dela e a criação da página com o
 * texto atual. Nada aqui roda sem o fof/pages habilitado.
 */
final class GuidelinesPage
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function available(): bool
    {
        return $this->extensions->isEnabled('fof-pages') && class_exists(Page::class);
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

    /**
     * Cria a página "Diretrizes" no fof/pages com o texto atual das
     * diretrizes do tema (o do admin, ou o padrão) e a escolhe.
     */
    public function create(): Page
    {
        $custom = trim((string) $this->settings->get(Community::GUIDELINES_TEXT));

        $page = new Page();
        $page->title = $this->translator->trans('ramon-canela.forum.community.guidelines.title');
        $page->slug = 'guidelines';
        $page->content = $custom !== '' ? $custom : $this->defaultMarkdown();
        $page->is_hidden = false;
        $page->is_restricted = false;
        $page->is_html = false;
        $page->save();

        $this->settings->set(Community::GUIDELINES_PAGE, (string) $page->id);

        return $page;
    }

    /** O texto padrão do tema, no idioma do fórum. */
    public function defaultMarkdown(): string
    {
        $locale = method_exists($this->translator, 'getLocale') ? (string) $this->translator->getLocale() : 'pt_BR';
        $file = str_starts_with(strtolower($locale), 'en') ? 'en' : 'pt-BR';

        return (string) @file_get_contents(__DIR__.'/Content/guidelines/'.$file.'.md');
    }
}
