<?php

/*
 * Roteador do `php -S` do benchmark: serve o fórum como um host bem
 * configurado (nginx com gzip e cache longo em /assets), para o Lighthouse
 * medir o tema e não a falta de compressão do servidor embutido.
 *
 * Uso: php -S 127.0.0.1:8080 -t public .github/scripts/php-router.php
 */

$root = $_SERVER['DOCUMENT_ROOT'];
$path = rawurldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$file = realpath($root.$path);
$gzip = str_contains($_SERVER['HTTP_ACCEPT_ENCODING'] ?? '', 'gzip');

if ($file !== false && is_file($file) && str_starts_with($file, realpath($root)) && ! str_ends_with($file, '.php')) {
    $types = [
        'js' => 'application/javascript', 'css' => 'text/css', 'json' => 'application/json',
        'svg' => 'image/svg+xml', 'woff2' => 'font/woff2', 'png' => 'image/png',
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp', 'ico' => 'image/x-icon',
        'map' => 'application/json', 'txt' => 'text/plain',
    ];
    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

    header('Content-Type: '.($types[$ext] ?? 'application/octet-stream'));
    // Os assets do Flarum mudam de nome (ou de ?v=) a cada revisão.
    header(str_starts_with($path, '/assets/') ? 'Cache-Control: public, max-age=31536000, immutable' : 'Cache-Control: public, max-age=3600');
    header('Vary: Accept-Encoding');

    $body = file_get_contents($file);

    if ($gzip && in_array($ext, ['js', 'css', 'json', 'svg', 'map', 'txt'], true)) {
        header('Content-Encoding: gzip');
        $body = gzencode($body, 6);
    }

    header('Content-Length: '.strlen($body));
    echo $body;

    return true;
}

// Páginas e API: o front controller do Flarum, com a resposta comprimida.
chdir($root);
$_SERVER['SCRIPT_NAME'] = '/index.php';
$_SERVER['SCRIPT_FILENAME'] = $root.'/index.php';

ob_start();
require $root.'/index.php';
$body = (string) ob_get_clean();

if ($gzip && ! headers_sent() && $body !== '') {
    // O tamanho que o Flarum calculou é o do corpo sem compressão.
    header_remove('Content-Length');
    header('Content-Encoding: gzip');
    header('Vary: Accept-Encoding');
    $body = gzencode($body, 6);
    header('Content-Length: '.strlen($body));
}

echo $body;
