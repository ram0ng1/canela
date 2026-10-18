<p align="center">
  <img src="https://raw.githubusercontent.com/ram0ng1/canela/refs/heads/master/icon.png" width="80" height="80" alt="Canela">
</p>

<h1 align="center">Canela</h1>

<p align="center">
  <a href="https://github.com/ram0ng1/canela/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/ram0ng1/canela/ci.yml?branch=master&style=flat-square&label=ci"></a>
  <a href="https://packagist.org/packages/ramon/canela"><img alt="Packagist" src="https://img.shields.io/packagist/v/ramon/canela?style=flat-square&label=packagist"></a>
  <a href="https://packagist.org/packages/ramon/canela"><img alt="Downloads" src="https://img.shields.io/packagist/dt/ramon/canela?style=flat-square"></a>
  <img alt="Flarum" src="https://img.shields.io/badge/flarum-2.x-e7672e?style=flat-square">
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square"></a>
  <a href="https://donate.stripe.com/fZe5o66nebkf39S28a"><img alt="Donate" src="https://img.shields.io/badge/donate-stripe-6772E5?style=flat-square"></a>
</p>

<p align="center">An unofficial theme for Flarum 2, inspired by the Discourse Horizon theme.</p>

Canela takes its inspiration from the Horizon theme of Discourse: a sidebar with sections, a discussion list in columns, a discussion timeline and profiles with a cover. Every part can be switched on or off in the admin panel.

The whole palette comes from Flarum's primary color, in light and dark mode, so the theme always matches your brand.

## What it does

- Sidebar with collapsible sections, centered search, light/dark/auto mode
- Discussion list in columns with views, posters and hot counts, plus New, Unread and Top tabs
- Discussion page with timeline, discussion map, suggested discussions and user cards
- Profiles with cover, bio, status, summary and activity tabs
- Bookmarks with reminders, badges and trust levels, About, Users and Groups pages
- Login and sign-up pages, keyboard shortcuts, edit history, bulk select and more
- Adapts fof/reactions, fof/drafts, fof/best-answer, ramon/chat and other extensions to the theme

## Installation

```sh
composer require ramon/canela
php flarum migrate
php flarum cache:clear
```

Enable Canela on the Extensions page. Every setting is in the admin panel with a description next to it. Bookmark reminders and daily badges use the Flarum scheduler, so run `php flarum schedule:run` from cron every minute.

## Languages

Brazilian Portuguese, English and Japanese ship with the theme. Core and extension strings come from the Flarum language packs.

## Credits

Inspired by the Horizon theme of <a href="https://www.discourse.org">Discourse</a>. Canela is an unofficial project, not affiliated with or endorsed by Discourse. It is maintained by <a href="https://ramonguilherme.com.br">Ramon Guilherme</a>.

## License

[MIT](LICENSE). Ideas and bug reports are welcome on the [issue tracker](https://github.com/ram0ng1/canela/issues).
