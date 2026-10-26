![Canela](https://cdn.ramonguilherme.com.br/downloads/canela/icon.png)

# Canela

[![Packagist](https://img.shields.io/packagist/v/ramon/canela?style=flat-square&label=packagist)](https://packagist.org/packages/ramon/canela) [![Downloads](https://img.shields.io/packagist/dt/ramon/canela?style=flat-square)](https://packagist.org/packages/ramon/canela) ![Flarum](https://img.shields.io/badge/flarum-2.x-e7672e?style=flat-square) [![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE) [![Donate](https://img.shields.io/badge/donate-stripe-6772E5?style=flat-square)](https://donate.stripe.com/fZe5o66nebkf39S28a)

**An unofficial theme for Flarum 2, inspired by the Discourse Horizon theme.**

Canela takes its inspiration from the Horizon theme of Discourse: a sidebar with sections, a discussion list in columns, a discussion timeline and profiles with a cover. Every part can be switched on or off in the admin panel.

The whole palette comes from Flarum's primary color, in light and dark mode, so the theme always matches your brand.

## What it does

- Sidebar with collapsible sections, centered search, light/dark/auto mode
- Discussion list in columns with views, posters and hot counts, plus New, Unread and Top tabs
- Discussion page with timeline, discussion map, suggested discussions and user cards
- Profiles with cover, bio, status, summary and activity tabs
- Bookmarks with reminders, badges and trust levels, About, Users and Groups pages
- Login and sign-up pages, keyboard shortcuts, edit history, bulk select and more
- "Report a problem": members mark an area of the screen and send it with a screenshot and page context; admins follow the reports in the panel (off by default)
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

Inspired by the Horizon theme of [Discourse](https://www.discourse.org). Canela is an unofficial project, not affiliated with or endorsed by Discourse. The "Report a problem" feature is based on [Bugframe](https://github.com/vmatheus3/bug-frame) (MIT) and draws the screenshot with [html-to-image](https://github.com/bubkoo/html-to-image) (MIT). It is maintained by [Ramon Guilherme](https://ramonguilherme.com.br).

## License

[MIT](LICENSE). Ideas and bug reports are welcome on the [issue tracker](https://github.com/ram0ng1/canela/issues).
