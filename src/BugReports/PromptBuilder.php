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

namespace Ramon\Canela\BugReports;

use Flarum\Extension\ExtensionManager;
use Flarum\Foundation\Application;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * Monta o texto que o admin cola numa IA: as instruções (AiPrompt), o
 * ambiente do fórum e os relatórios (Worklist), com links assinados das
 * capturas para a IA conseguir abri-las.
 */
final class PromptBuilder
{
    public function __construct(
        private readonly BugReportService $reports,
        private readonly ImageLinks $links,
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
        private readonly UrlGenerator $url,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /** @param iterable<BugReport> $rows */
    public function build(iterable $rows, bool $withInstructions = true): string
    {
        $presented = [];

        foreach ($rows as $report) {
            $presented[] = $this->reports->present($report, true);
        }

        $portuguese = str_starts_with(strtolower($this->translator->getLocale()), 'pt');
        $title = (string) $this->settings->get('forum_title', 'Flarum');
        $api = rtrim($this->url->to('api')->base(), '/');

        $header = $withInstructions ? AiPrompt::header($this->forum($title), count($presented), $portuguese) : null;

        return Worklist::markdown(
            $presented,
            $title,
            fn (int $id, string $which): string => "$api/canela-bug-reports/$id/$which".$this->links->query($id, $which),
            $header,
            $portuguese,
        );
    }

    /** @return array{title: string, url: string, flarum: string, theme: string, extensions: list<string>} */
    private function forum(string $title): array
    {
        $names = [];

        foreach ($this->extensions->getEnabledExtensions() as $extension) {
            $names[] = $extension->name.($extension->getVersion() ? ' '.$extension->getVersion() : '');
        }

        sort($names);

        return [
            'title' => $title,
            'url' => rtrim($this->url->to('forum')->base(), '/'),
            'flarum' => Application::VERSION,
            'theme' => (string) ($this->extensions->getExtension('ramon-canela')?->getVersion() ?: 'dev'),
            'extensions' => $names,
        ];
    }
}
