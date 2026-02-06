# DopeWifiTest - Terminal Speed Test (PowerShell)
# Usage: irm https://DOMAIN/run.ps1 | iex
param(
    [switch]$json
)

$ErrorActionPreference = 'Stop'
$Base = "https://dopespeedtest.paulohponta.workers.dev"
$DlSizes = @(5000000, 10000000, 25000000)

# --- Logo ---
function Show-Logo {
    @"
 (
 )\ )                     (  (          (          *   )             )
(()/(                 (   )\))(   ' (   )\ )  (  `` )  /(   (      ( /(
 /(_))   (   ``  )    ))\ ((_)()\ )  )\ (()/(  )\  ( )(_)) ))\ (   )\())
(_))_    )\  /(/(   /((_)_(())\_)()((_) /(_))((_)(_(_()) /((_))\ (_))/
 |   \  ((_)((_)_\ (_))  \ \((_)/ / (_)(_) _| (_)|_   _|(_)) ((_)| |_
 | |) |/ _ \| '_ \)/ -_)  \ \/\/ /  | | |  _| | |  | |  / -_)(_-<|  _|
 |___/ \___/| .__/ \___|   \_/\_/   |_| |_|   |_|  |_|  \___|/__/ \__|
            |_|
"@ | Write-Host
}

# --- Utilities ---
function Get-Median([double[]]$Values) {
    $sorted = $Values | Sort-Object
    $count = $sorted.Count
    if ($count -eq 0) { return 0 }
    if ($count % 2 -eq 1) {
        return $sorted[[Math]::Floor($count / 2)]
    } else {
        return ($sorted[$count / 2 - 1] + $sorted[$count / 2]) / 2
    }
}

function Get-Mean([double[]]$Values) {
    if ($Values.Count -eq 0) { return 0 }
    return ($Values | Measure-Object -Average).Average
}

function Make-Bar([double]$Value, [double]$Max, [int]$Width = 20) {
    if ($Max -le 0) { $ratio = 0 } else { $ratio = [Math]::Min(1, $Value / $Max) }
    $filled = [int][Math]::Round($ratio * $Width)
    $empty = $Width - $filled
    return ('#' * $filled) + ('.' * $empty)
}

# --- Ping ---
Write-Host "  Testing latency..."
$pings = @()
for ($i = 1; $i -le 10; $i++) {
    $cachebust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $url = "$Base/ping?cachebust=$cachebust"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $null = Invoke-WebRequest -Uri $url -UseBasicParsing
    $sw.Stop()
    $ms = [Math]::Round($sw.Elapsed.TotalMilliseconds, 1)
    $pings += $ms
    Write-Host ("    ping {0}/10: {1} ms" -f $i, $ms)
}
$PingMedian = [Math]::Round((Get-Median $pings), 1)
$PingMean = [Math]::Round((Get-Mean $pings), 1)

# --- Download ---
Write-Host ""
Write-Host "  Testing download..."
$dlSpeeds = @()
$round = 1
foreach ($size in $DlSizes) {
    $cachebust = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $url = "$Base/down?bytes=$size&cachebust=$cachebust"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $null = Invoke-WebRequest -Uri $url -UseBasicParsing
    $sw.Stop()
    $mbps = [Math]::Round(($size * 8) / ($sw.Elapsed.TotalSeconds * 1e6), 2)
    $dlSpeeds += $mbps
    $sizeMb = [Math]::Round($size / 1e6, 0)
    Write-Host ("    round {0}/3 ({1} MB): {2} Mbps" -f $round, $sizeMb, $mbps)
    $round++
}
$DlMedian = [Math]::Round((Get-Median $dlSpeeds), 2)
$DlMean = [Math]::Round((Get-Mean $dlSpeeds), 2)

# --- Results ---
Write-Host ""

if ($json) {
    $result = @{
        ping = @{ median = $PingMedian; mean = $PingMean }
        download = @{ median = $DlMedian; mean = $DlMean }
    }
    $result | ConvertTo-Json -Depth 3
} else {
    Show-Logo
    Write-Host ""

    $dlBar = Make-Bar $DlMedian $DlMedian

    Write-Host "  +------------------------------------------------------+"
    Write-Host "  |                    DopeWifiTest                       |"
    Write-Host "  +------------------------------------------------------+"
    Write-Host ("  |  DL   {0}  {1,8} Mbps  (median)     |" -f $dlBar, $DlMedian)
    Write-Host ("  |  PING                      {0,8} ms   (median)     |" -f $PingMedian)
    Write-Host "  |                                                      |"
    Write-Host ("  |  DL   mean: {0,8} Mbps                            |" -f $DlMean)
    Write-Host ("  |  PING mean: {0,8} ms                              |" -f $PingMean)
    Write-Host "  +------------------------------------------------------+"
    Write-Host ""
    Write-Host "  Note: Measures client <-> Cloudflare edge, not ISP speed."
}
