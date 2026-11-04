/**
 * Hand-maintained map of tool slug -> "owner/repo" on GitHub, used by `npm run sync`
 * for tools whose canonical `url` is not itself a github.com link.
 *
 * Debian is intentionally omitted: it has no single canonical GitHub repo (its
 * packages live across many separate source packages mirrored from Salsa/FTP,
 * not a unified GitHub project), so there is no meaningful "stars" or
 * "last commit" to attach to it.
 */
export const repoMap: Record<string, string> = {
  // Peanut Butter — Operating systems & servers
  linux: "torvalds/linux",
  freebsd: "freebsd/freebsd-src",
  kubernetes: "kubernetes/kubernetes",
  podman: "containers/podman",
  nginx: "nginx/nginx",
  "apache-http-server": "apache/httpd",
  openssh: "openssh/openssh-portable",
  opentofu: "opentofu/opentofu",
  prometheus: "prometheus/prometheus",
  caddy: "caddyserver/caddy",
  ansible: "ansible/ansible",

  // Strawberry Jam — Languages & runtimes
  python: "python/cpython",
  rust: "rust-lang/rust",
  go: "golang/go",
  "node-js": "nodejs/node",
  typescript: "microsoft/TypeScript",
  ruby: "ruby/ruby",
  php: "php/php-src",
  kotlin: "JetBrains/kotlin",
  swift: "swiftlang/swift",
  elixir: "elixir-lang/elixir",
  zig: "ziglang/zig",
  llvm: "llvm/llvm-project",

  // Mustard — Developer tools & frameworks
  git: "git/git",
  neovim: "neovim/neovim",
  emacs: "emacs-mirror/emacs",
  vscodium: "VSCodium/vscodium",
  curl: "curl/curl",
  jupyter: "jupyterlab/jupyterlab",
  react: "facebook/react",
  vue: "vuejs/core",
  svelte: "sveltejs/svelte",
  vite: "vitejs/vite",
  django: "django/django",
  "ruby-on-rails": "rails/rails",

  // Guacamole — Data, databases & AI
  postgresql: "postgres/postgres",
  sqlite: "sqlite/sqlite",
  mariadb: "MariaDB/server",
  valkey: "valkey-io/valkey",
  duckdb: "duckdb/duckdb",
  clickhouse: "ClickHouse/ClickHouse",
  "apache-kafka": "apache/kafka",
  "apache-spark": "apache/spark",
  pandas: "pandas-dev/pandas",
  numpy: "numpy/numpy",
  pytorch: "pytorch/pytorch",
  grafana: "grafana/grafana",

  // Cocoa Hazelnut — Everyday & creative apps
  firefox: "mozilla/gecko-dev",
  blender: "blender/blender",
  gimp: "GNOME/gimp",
  inkscape: "inkscape/inkscape",
  krita: "KDE/krita",
  libreoffice: "LibreOffice/core",
  vlc: "videolan/vlc",
  audacity: "audacity/audacity",
  "obs-studio": "obsproject/obs-studio",
  thunderbird: "mozilla/releases-comm-central",
  signal: "signalapp/Signal-Desktop",
  keepassxc: "keepassxreboot/keepassxc",
};
