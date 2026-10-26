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

namespace Ramon\Canela\Links;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Http\UrlGenerator;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;

/**
 * Os cliques nos links das postagens:
 * gravar, contar por tópico e por autor.
 *
 * Os links não ganham tabela própria: eles já
 * estão no XML de cada postagem (`<URL url="…">`), e o tema os lê de lá —
 * para conferir se o clique é num link que existe e para listar os links do
 * tópico, com cache.
 */
final class LinkClicks
{
    public const TABLE = 'canela_link_clicks';

    public const ENABLED = 'canela.stats_links_enabled';

    /** Conta um clique por link por pessoa (ou IP) por dia. */
    public const DEDUPE_SECONDS = 86400;

    /** Teto de cliques por minuto de uma mesma pessoa ou IP: mais que isso é script. */
    public const MAX_PER_MINUTE = 30;

    /** Quantos links o mapa do tópico recebe, e quantas postagens o tema lê para achá-los. */
    private const TOPIC_LINKS_LIMIT = 30;

    private const TOPIC_POSTS_SCANNED = 1000;

    /** Teto de links distintos guardados por tópico: o mapa só mostra os primeiros. */
    private const TOPIC_LINKS_SCANNED = 200;

    private const CACHE_TTL = 600;

    public const MAX_URL_LENGTH = 2000;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Cache $cache,
        private readonly SettingsRepositoryInterface $settings,
        private readonly UrlGenerator $url,
    ) {
    }

    public function enabled(): bool
    {
        // Sem o recurso carregado não há o ->default(): o get() volta null e
        // tudo fica desligado, mesmo que a tabela exista.
        return in_array($this->settings->get(self::ENABLED), [true, 1, '1', 'true'], true);
    }

    /**
     * Os links de um XML de postagem, na ordem em que aparecem: endereço e
     * texto (vazio quando o texto é o próprio endereço, como num link solto).
     *
     * @return list<array{url: string, text: string}>
     */
    public static function extract(?string $xml): array
    {
        if ($xml === null || ! str_contains($xml, '<URL ')) {
            return [];
        }

        // O s9e grava os atributos em ordem alfabética: um link com título
        // (`[texto](url "título")`) vira `<URL title="…" url="…">`, com o `url`
        // depois. Dentro de um valor as aspas vêm como `&quot;`, então
        // ` url="` só aparece como atributo.
        preg_match_all('#<URL\b[^>]*?\surl="([^"]*)"[^>]*>(.*?)</URL>#s', $xml, $matches, PREG_SET_ORDER);

        $links = [];

        foreach ($matches as [, $url, $inner]) {
            $url = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            // `<s>[</s>texto<e>](url)</e>`: o que sobra sem os marcadores do
            // Markdown é o texto do link.
            $text = preg_replace('#<([se])>.*?</\1>#s', '', $inner) ?? '';
            $text = trim(html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            $links[] = ['url' => $url, 'text' => $text === $url ? '' : mb_substr($text, 0, 200)];
        }

        return $links;
    }

    /** Só http(s) e para fora do fórum: os links internos ficam de fora. */
    public function isExternal(string $url): bool
    {
        $parts = parse_url($url);

        if (! is_array($parts) || ! in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
            return false;
        }

        $forumHost = parse_url($this->url->to('forum')->base(), PHP_URL_HOST);

        return strcasecmp((string) $parts['host'], (string) $forumHost) !== 0;
    }

    public static function hash(string $url): string
    {
        return sha1($url);
    }

    public function record(Post $post, string $url, ?int $userId): void
    {
        $this->db->table(self::TABLE)->insert([
            'post_id' => $post->id,
            'discussion_id' => $post->discussion_id,
            'user_id' => $userId,
            'url_hash' => self::hash($url),
            'url' => $url,
            'created_at' => Carbon::now(),
        ]);
    }

    /**
     * Os links externos do tópico com os cliques, mais clicados primeiro (o
     * "Links populares" do mapa), e os cliques de cada link em cada postagem
     * (o número ao lado do link). Conta só postagens que todo leitor do
     * tópico vê, então serve igual para todos.
     *
     * @return array{total: int, top: list<array<string, mixed>>, posts: array<string, array<string, int>>}
     */
    public function forDiscussion(Discussion $discussion): array
    {
        $links = $this->topicLinks($discussion);

        // Os apelidos pela gramática no SQL cru: com prefixo de tabela, `c`
        // vira `flarum_c`, e um `c.url` solto apontaria para nada.
        $g = $this->db->table(self::TABLE)->getGrammar();

        $rows = $this->db->table(self::TABLE.' as c')
            ->join('posts as p', 'p.id', '=', 'c.post_id')
            ->where('c.discussion_id', $discussion->id)
            ->where('p.type', 'comment')
            ->whereNull('p.hidden_at')
            ->where('p.is_private', false)
            ->groupBy('c.post_id', 'c.url_hash')
            ->select('c.post_id', 'c.url_hash', $this->db->raw('MAX('.$g->wrap('c.url').') as url'), $this->db->raw('COUNT(*) as clicks'))
            ->get();

        $posts = [];
        $byHash = [];

        foreach ($rows as $row) {
            $posts[(string) $row->post_id][(string) $row->url] = (int) $row->clicks;
            $byHash[(string) $row->url_hash] = ($byHash[(string) $row->url_hash] ?? 0) + (int) $row->clicks;
        }

        foreach ($links as &$link) {
            $link['clicks'] = $byHash[self::hash($link['url'])] ?? 0;
        }
        unset($link);

        // Mais clicados primeiro; empate fica na ordem em que aparecem no tópico.
        $order = array_keys($links);
        array_multisort(array_column($links, 'clicks'), SORT_DESC, $order, SORT_ASC, $links);

        return [
            'total' => count($links),
            'top' => array_slice($links, 0, self::TOPIC_LINKS_LIMIT),
            'posts' => $posts,
        ];
    }

    /**
     * Os links externos distintos do tópico, na ordem em que aparecem, com o
     * texto e a postagem onde surgiram primeiro. Ler o XML de mil postagens a
     * cada abertura do tópico seria caro: fica em cache, e a chave muda quando
     * chega resposta nova (edições entram quando o cache vence).
     *
     * @return list<array{url: string, title: string|null, domain: string, postId: string, postNumber: int}>
     */
    private function topicLinks(Discussion $discussion): array
    {
        $key = sprintf('canela.links.topic.%d.%s', $discussion->id, md5($discussion->last_posted_at.'|'.$discussion->comment_count));

        $build = fn (): array => $this->cache->remember($key, self::CACHE_TTL, function () use ($discussion): array {
            $links = [];

            // Em lotes de 100 (e não as mil de uma vez): o XML de cada postagem
            // pode ter dezenas de KB, e tudo junto estoura a memória.
            $posts = $this->db->table('posts')
                ->where('discussion_id', $discussion->id)
                ->where('type', 'comment')
                ->whereNull('hidden_at')
                ->where('is_private', false)
                ->where('content', 'like', '%<URL %')
                ->orderBy('number')
                ->limit(self::TOPIC_POSTS_SCANNED)
                ->select('id', 'number', 'content')
                ->lazy(100);

            foreach ($posts as $post) {
                foreach (self::extract($post->content) as $link) {
                    if (isset($links[$link['url']]) || ! $this->isExternal($link['url'])) {
                        continue;
                    }

                    $links[$link['url']] = [
                        'url' => $link['url'],
                        'title' => $link['text'] !== '' ? $link['text'] : null,
                        'domain' => (string) parse_url($link['url'], PHP_URL_HOST),
                        'postId' => (string) $post->id,
                        'postNumber' => (int) $post->number,
                    ];

                    if (count($links) >= self::TOPIC_LINKS_SCANNED) {
                        break 2;
                    }
                }
            }

            return array_values($links);
        });

        // Uma resposta nova invalida a chave para todos: com a trava, só uma
        // requisição remonta a lista, e as outras esperam e leem o cache.
        $store = $this->cache->getStore();

        if (! $store instanceof LockProvider) {
            return $build();
        }

        try {
            return $store->lock('canela.links.topic.'.$discussion->id, 10)->block(5, $build);
        } catch (LockTimeoutException) {
            return $build();
        }
    }

    /**
     * "Melhores links" do resumo do perfil: os links das postagens da pessoa
     * com mais cliques, cada um com o tópico onde está.
     *
     * @param Builder $visiblePosts os ids das postagens que o ator vê
     * @return list<array<string, mixed>>
     */
    public function topForUser(int $userId, Builder $visiblePosts, int $limit): array
    {
        $g = $this->db->table(self::TABLE)->getGrammar();

        $rows = $this->db->table(self::TABLE.' as c')
            ->join('posts as p', 'p.id', '=', 'c.post_id')
            ->where('p.user_id', $userId)
            ->where('p.type', 'comment')
            ->whereIn('p.id', $visiblePosts)
            ->groupBy('c.url_hash')
            ->select('c.url_hash', $this->db->raw('MAX('.$g->wrap('c.url').') as url'), $this->db->raw('MIN('.$g->wrap('c.post_id').') as post_id'), $this->db->raw('COUNT(*) as clicks'))
            ->orderByDesc('clicks')
            ->limit($limit)
            ->get();

        if ($rows->isEmpty()) {
            return [];
        }

        $posts = Post::query()->with('discussion')->whereKey($rows->pluck('post_id')->all())->get()->keyBy('id');
        $result = [];

        foreach ($rows as $row) {
            $post = $posts->get((int) $row->post_id);
            $discussion = $post?->discussion;

            if (! $post || ! $discussion) {
                continue;
            }

            $title = null;

            foreach (self::extract($post->getRawOriginal('content')) as $link) {
                if ($link['url'] === $row->url && $link['text'] !== '') {
                    $title = $link['text'];
                    break;
                }
            }

            $result[] = [
                'url' => (string) $row->url,
                'title' => $title,
                'domain' => (string) parse_url((string) $row->url, PHP_URL_HOST),
                'clicks' => (int) $row->clicks,
                'postNumber' => (int) $post->number,
                'discussionId' => (string) $discussion->id,
                'discussionSlug' => (string) $discussion->slug,
                'discussionTitle' => (string) $discussion->title,
            ];
        }

        return $result;
    }
}
