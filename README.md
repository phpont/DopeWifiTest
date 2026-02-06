```
 (
 )\ )                     (  (          (          *   )             )
(()/(                 (   )\))(   ' (   )\ )  (  ` )  /(   (      ( /(
 /(_))   (   `  )    ))\ ((_)()\ )  )\ (()/(  )\  ( )(_)) ))\ (   )\())
(_))_    )\  /(/(   /((_)_(())\_)()((_) /(_))((_)(_(_()) /((_))\ (_))/
 |   \  ((_)((_)_\ (_))  \ \((_)/ / (_)(_) _| (_)|_   _|(_)) ((_)| |_
 | |) |/ _ \| '_ \)/ -_)  \ \/\/ /  | | |  _| | |  | |  / -_)(_-<|  _|
 |___/ \___/| .__/ \___|   \_/\_/   |_| |_|   |_|  |_|  \___|/__/ \__|
            |_|
```

A personal project I built for myself: a Wi-Fi/internet speed test with a terminal/ASCII look that I actually like. Made to be easy to run on mobile/desktop in the browser, and also from the terminal with a single command.

v1.0 measures latency and download only. Upload was removed to keep results consistent with the Worker-based backend.

## What’s in here

* Terminal/ASCII UI (pure black & white, monospace)
* Live download progress (ASCII bar + Mbps)
* CLI scripts (Linux/macOS + Windows) with a one-liner
* 100% static frontend (deploy on Vercel, Netlify, Pages, etc.)
* Simple Cloudflare Worker backend (`/ping`, `/down`)

## Use it

Web:

* Open the site and run the test on the page.

CLI:

Linux / macOS:

```bash
curl -fsSL https://YOUR_DOMAIN/run | sh
```

JSON output:

```bash
curl -fsSL https://YOUR_DOMAIN/run | sh -s -- --json
```

Windows (PowerShell):

```powershell
irm https://YOUR_DOMAIN/run.ps1 | iex
```

## Make a `dopewifitest` command (aliases)

Goal: type `dopewifitest` and it runs the normal CLI test.

### Linux / macOS (recommended: wrapper script)

1. Create a local bin folder:

```bash
mkdir -p ~/.local/bin
```

2. Create the command:

```bash
cat > ~/.local/bin/dopewifitest <<'EOF'
#!/usr/bin/env sh
curl -fsSL https://YOUR_DOMAIN/run | sh -s -- "$@"
EOF
chmod +x ~/.local/bin/dopewifitest
```

3. Ensure `~/.local/bin` is in your PATH:

For bash (`~/.bashrc`):

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

For zsh (`~/.zshrc`):

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Now you can run:

```bash
dopewifitest
```

And JSON if supported by your script:

```bash
dopewifitest --json
```

### Windows (PowerShell profile function)

1. Open your PowerShell profile (creates it if missing):

```powershell
if (!(Test-Path $PROFILE)) { New-Item -Type File -Path $PROFILE -Force | Out-Null }
notepad $PROFILE
```

2. Paste this function into the profile file:

```powershell
function dopewifitest {
  param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)

  $code = irm https://YOUR_DOMAIN/run.ps1
  $sb = [ScriptBlock]::Create($code)
  & $sb @Args
}
```

3. Restart PowerShell (or reload the profile):

```powershell
. $PROFILE
```

Now run:

```powershell
dopewifitest
```

If your script supports JSON mode:

```powershell
dopewifitest --json
```

## Worker backend

The backend is a Cloudflare Worker exposing:

* `GET /ping` -> 204 (latency measurement)
* `GET /down?bytes=N` -> streams N bytes (max 50 MB)

CORS is enabled and `Cache-Control: no-store` is set.

If you want to point the app to your own Worker:

* Set `VITE_SPEEDTEST_BASE_URL=https://your-worker.your-domain.workers.dev` in your host env vars (Vercel/Netlify) or a `.env` file.

## How it works

Web:

* Quick `/ping` to verify the Worker is reachable
* Ping: 10 requests to `/ping`, median latency
* Download: 1 warmup + 3 rounds, streaming `/down?bytes=N`, live Mbps updates and final median/mean/peak

CLI:

* Ping: `curl` timing against `/ping`
* Download: `curl --write-out '%{speed_download}'` against `/down?bytes=N`

## Important note

This measures the speed between your device and the nearest Cloudflare edge where the Worker runs. It’s a solid proxy for your connection quality, but it won’t always match what your ISP advertises (routing and congestion matter).

## Tech

* Frontend: Vite + React + TypeScript (no UI libs, plain CSS)
* Backend: Cloudflare Worker (`/ping`, `/down`)
* Deploy: any static host

## License

MIT
