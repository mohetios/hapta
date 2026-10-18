# Hapta | هَپتا

[![Build](https://github.com/mohetios/Hapta/actions/workflows/release.yml/badge.svg)](https://github.com/mohetios/Hapta/actions/workflows/release.yml)
[![License: GPL v3](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)

**Hapta** is a minimalist, privacy-focused weekly planner for Persian speakers, built on top of [WeekToDo](https://github.com/manuelernestog/weektodo).
The goal: first-class **Jalali (Solar Hijri) calendar**, proper **RTL / Persian** UI, and a set of custom tweaks.

> The name comes from the Old Iranian root *haptá*, meaning "seven" (not "week" itself). It's a branding choice, not an attested word for "week".
>
> نام «هَپتا» برگرفته از ریشهٔ ایرانی باستانِ *haptá* به معنی «هفت» است، نه خود «هفته».

## Status

Early stage. Right now the code is upstream WeekToDo with cleaned-up infrastructure (CI builds for Linux and Windows).
Persian / Jalali work starts once this baseline is stable.

## Roadmap

- [x] Fork + CI builds (Linux AppImage/deb, Windows installer)
- [ ] Clean-up and stable baseline
- [ ] Jalali calendar (week starts on Saturday, Persian month names, Jalali dates throughout)
- [ ] Full RTL layout and Persian fonts
- [ ] Persian digits and localisation
- [ ] Custom tweaks

## Download

Builds from `main` are attached to each [Actions run](https://github.com/mohetios/Hapta/actions) as artifacts.
Tagged versions (`v*`) are published on the [Releases](https://github.com/mohetios/Hapta/releases) page.

## Build from source

Requires Node.js 16 and Yarn (webpack 4 doesn't work on Node 17+).

```bash
git clone https://github.com/mohetios/Hapta
cd Hapta
yarn install
yarn serve            # web version
yarn electron:serve   # desktop version
yarn electron:build   # package the desktop app
```

## Credits

Hapta is a fork of [WeekToDo](https://github.com/manuelernestog/weektodo) by [Manuel Ernesto Garcia](https://manuelernestogr.bio.link/) and its contributors.
If you'd like to support the original project: https://weektodo.me/support-us

## License

[GPL-3.0](LICENSE), same as upstream.
