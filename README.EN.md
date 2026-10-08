<p align="center">
  <img src="src/assets/app-icon.png" alt="RoadCraft Studio logo" width="96" />
</p>

<h1 align="center">RoadCraft Studio</h1>

<p align="center">Build, transport and recover. A visual editor for your RoadCraft fleet and saves.</p>

<p align="center">
  <a href="https://github.com/OscarD0823/roadcraft/releases/latest"><strong>Download for Windows</strong></a> ·
  <a href="docs/user-guide.md">User guide (Spanish)</a> ·
  <a href="CHANGELOG.md">Release history</a> ·
  <a href="README.md">Español</a>
</p>

## Install

Open **Assets** on the [latest release](https://github.com/OscarD0823/roadcraft/releases/latest) and download the **Setup.exe** installer. Requires Windows x64 and a local RoadCraft installation; Node.js is only needed for development. Updates are distributed through GitHub, not Microsoft Store.

## Features

- Separate vehicle, trailer and Logistics libraries, with rescanning for installed content and supported mod sources.
- A persistent local 3D preview beside grouped vehicle and work-equipment settings.
- Original values, protected ranges, three recommendation levels, backups and restoration.
- Sand-load and work-width controls, plus the ZikZ's long-range resource supply where supported.
- Free Roads with explicit confirmation, preserving mandatory truck permissions.
- Shared edits for the same source file across library sections; compatible family variants can be linked separately.
- CompleteSave editing, local save discovery and supported company-paint previews.

The interface offers 15 languages. Spanish and English are fully translated; other languages have core translations with English fallback.

## Safety and limitations

Close the game and back up your save before making changes. Protected ranges are precautions, not a physics-stability guarantee. Only **Save changes** writes pending adjustments; closing the editor discards session drafts.

Free Roads and the ZikZ's 10 km supply were tested in-game by the user, not validated universally across maps or mods. Restoring zone rules does not undo saved terrain. The preview is a custom scene using compatible local assets, not the game's engine.

See the [documentation index](docs/README.md), [development guide](docs/development.md) and [release history](CHANGELOG.md).

## Author and license

By [@OscarD0823](https://github.com/OscarD0823). Companion project: [SnowRunner Studio](https://github.com/OscarD0823/snowrunner).

[MIT license](LICENSE) · [Resource and dependency notices](NOTICE.md). Unofficial tool, not affiliated with the game's rights holders. Game models, textures and shop images are read locally and are not redistributed.
