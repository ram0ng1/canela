<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Http;

use Psr\Http\Message\ServerRequestInterface;

/**
 * O que as estatísticas precisam saber de quem fez a requisição: se é um robô,
 * se está no celular e um identificador estável para visitantes sem conta.
 */
final class Visitor
{
    /**
     * A detecção de robôs do Discourse (CrawlerDetection.crawler?), com as
     * listas padrão dele: o que não se parece com um navegador
     * (`non_crawler_user_agents`) é robô; o que se parece, mas se declara robô
     * (`crawler_user_agents`) ou é automação (`crawler_automation_user_agents`),
     * também. Robô não conta visualização — um Googlebot passando por mil
     * tópicos não é interesse de ninguém.
     */
    private const BROWSER_PATTERN = '/trident|webkit|gecko|chrome|safari|msie|opera|goanna|discourse/i';

    private const CRAWLER_PATTERN = '/rss|bot|spider|crawler|facebook|archive|wayback|ping|monitor|lighthouse|google-inspectiontool|gptbot|claudebot|anthropic-ai|brightbot|googleother|yeti|perplexity-user|claude-user/i';

    private const AUTOMATION_PATTERN = '/HeadlessChrome|Playwright|Puppeteer|Selenium|PhantomJS|jsdom/i';

    private const MOBILE_PATTERN = '/Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i';

    public function __construct(
        private readonly ServerRequestInterface $request
    ) {
    }

    public function userAgent(): string
    {
        return mb_substr($this->request->getHeaderLine('User-Agent'), 0, 512);
    }

    public function isCrawler(): bool
    {
        $userAgent = $this->userAgent();

        // Sem User-Agent nenhum, é script — navegadores sempre mandam.
        if ($userAgent === '' || preg_match(self::BROWSER_PATTERN, $userAgent) !== 1) {
            return true;
        }

        return preg_match(self::CRAWLER_PATTERN, $userAgent) === 1
            || preg_match(self::AUTOMATION_PATTERN, $userAgent) === 1;
    }

    public function isMobile(): bool
    {
        return preg_match(self::MOBILE_PATTERN, $this->userAgent()) === 1;
    }

    /**
     * IP + navegador, com o sal do fórum. O navegador entra para que duas
     * pessoas atrás do mesmo NAT (uma escola, um escritório) não virem uma só;
     * o sal, para o hash não ser revertido testando todos os IPs.
     */
    public function hash(string $salt): string
    {
        $ip = (string) ($this->request->getAttribute('ipAddress') ?? '');

        return hash('sha256', $salt.'|'.$ip.'|'.$this->userAgent());
    }

    /**
     * Só o IP, com o sal: a identidade do visitante nas visualizações de
     * tópico, que no Discourse é o IP — trocar de navegador no mesmo
     * computador não é outra pessoa vendo o tópico.
     */
    public function ipHash(string $salt): string
    {
        $ip = (string) ($this->request->getAttribute('ipAddress') ?? '');

        return hash('sha256', $salt.'|ip|'.$ip);
    }
}
