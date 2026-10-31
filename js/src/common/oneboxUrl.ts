/*
 * Os links do GitHub que podem virar cartão (o servidor confere de novo, em
 * src/Onebox/GithubUrl.php). Num arquivo à parte para o fórum reconhecer o
 * link sem baixar o desenho do cartão, que vem sob demanda.
 */
export const GITHUB_URL = /^https:\/\/(www\.)?github\.com\/[^/?#\s]+\/[^/?#\s]+(\/(blob|issues|pull|commit|releases)\/[^\s]+)?\/?(#L\d+(-L?\d+)?)?$/i;
