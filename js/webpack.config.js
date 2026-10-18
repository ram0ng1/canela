const config = require('flarum-webpack-config')();

// IDs nomeados: os numéricos (padrão do webpack) colidem com os de outras
// extensões no `webpackChunkmodule_exports` global, e um chunk assíncrono
// carregado depois quebra com "s[t] is not a function".
config.optimization = config.optimization || {};
config.optimization.moduleIds = 'named';
config.optimization.chunkIds = 'named';

module.exports = config;
