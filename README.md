# Source

**Open Source Spread** — a sandwich-making website where spreading "source" on a slice of bread uncovers open source software.

Pick a jar, drag the butter knife across the bread, and every swipe reveals real open source tools written in the spread. Each one you find gets a card with a short description, its license and a link to the project.

## The pantry

| Jar | What's inside |
| --- | --- |
| Peanut Butter | Operating systems & servers (Linux, Kubernetes, nginx…) |
| Strawberry Jam | Languages & runtimes (Python, Rust, Go…) |
| Mustard | Developer tools & frameworks (Git, React, Neovim…) |
| Guacamole | Data, databases & AI (PostgreSQL, PyTorch, DuckDB…) |
| Cocoa Hazelnut | Everyday & creative apps (Firefox, Blender, VLC…) |

60 tools in total. A "Spread Facts" label (styled like a nutrition label) tallies the licenses of everything you've found.

## Run it

It's a single static file with no build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

To publish it, enable GitHub Pages for this repo (Settings → Pages → deploy from the `main` branch).

## Adding tools

Tools live in the `JARS` array near the top of the `<script>` in `index.html`. Each entry is:

```js
{ n: "Name", s: "Short label (optional)", lic: "SPDX license", d: "One-line description.", url: "https://project.site" }
```
