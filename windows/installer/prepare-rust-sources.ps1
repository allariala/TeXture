# PowerShell 7. Collect locked Rust dependency sources for the shipped Python native modules.
# Reads Cargo.lock as data; never runs cargo, compilers, or downloaded code.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$cache = Join-Path $PSScriptRoot '.release-cache'
$archiveDir = Join-Path $cache 'sources'
$indexPath = Join-Path $cache 'source-index.json'
$index = @(Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json)
$jobs = @{}
foreach ($source in $index | Where-Object { $_.name -in @('tokenizers','safetensors','pydantic-core','hf-xet') }) {
    $archive = Join-Path $archiveDir $source.archive
    $entries = @(& tar -tf $archive)
    $lockPaths = @($entries | Where-Object { $_ -match '(^|/)Cargo\.lock$' })
    if ($lockPaths.Count -eq 0) { throw "Missing resolved Rust dependency lock: $($source.name)" }
    foreach ($lockPath in $lockPaths) {
        $lock = (& tar -xOf $archive $lockPath) -join "`n"
        foreach ($block in [regex]::Matches($lock, '(?ms)^\[\[package\]\]\s*(.*?)(?=^\[\[package\]\]|\z)')) {
            $text = $block.Groups[1].Value
            $name = [regex]::Match($text, '(?m)^name = "([A-Za-z0-9_-]+)"').Groups[1].Value
            $version = [regex]::Match($text, '(?m)^version = "([^"]+)"').Groups[1].Value
            $origin = [regex]::Match($text, '(?m)^source = "([^"]+)"').Groups[1].Value
            if (-not $origin) { continue } # Workspace source is in the parent sdist.
            $checksum = [regex]::Match($text, '(?m)^checksum = "([0-9a-f]{64})"').Groups[1].Value
            if ($origin.StartsWith('registry+')) {
                if (-not $checksum) { throw "Missing registry checksum: $name $version" }
                $filename = "rust-$name-$version.crate"
                $job = [ordered]@{name="cargo/$name";version=$version;url="https://static.crates.io/crates/$name/$name-$version.crate";archive=$filename;expected=$checksum;source_path="rust-crates/$name-$version"}
            } elseif ($origin -match '^git\+https://github\.com/([^?#]+?)(?:\.git)?(?:\?[^#]*)?#([0-9a-f]{40})$') {
                $repo = $Matches[1]; $commit = $Matches[2]
                $filename = 'rust-git-' + $repo.Replace('/','-') + '-' + $commit + '.tar.gz'
                $job = [ordered]@{name=$repo;version=$commit;url="https://codeload.github.com/$repo/tar.gz/$commit";archive=$filename;expected='';source_path="rust-git/$repo"}
            } else { throw "Unsupported Rust source registry: $origin" }
            $jobs[$filename] = $job
        }
    }
}
Write-Host "Collecting $($jobs.Count) locked Rust source archives."
$results = @($jobs.Values | ForEach-Object -Parallel {
    $job = $_
    $destination = Join-Path $using:archiveDir $job.archive
    try {
        $ready = (Test-Path -LiteralPath $destination) -and ((-not $job.expected) -or (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash -eq $job.expected)
        if (-not $ready) {
            $partial = $destination + '.partial'
            $downloaded = $false
            for ($attempt = 0; $attempt -lt 3; $attempt++) {
                try {
                    Invoke-WebRequest -Uri $job.url -OutFile $partial -TimeoutSec 90 -Headers @{'User-Agent'='TeXture-release-source/2.1.1'}
                    $downloaded = $true; break
                } catch { if ($attempt -eq 2) { throw }; Start-Sleep -Seconds 1 }
            }
            if (-not $downloaded) { throw 'No source response.' }
            if ($job.expected -and (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $job.expected) { throw 'Cargo.lock checksum mismatch.' }
            Move-Item -LiteralPath $partial -Destination $destination -Force
        }
        [PSCustomObject]@{job=$job;sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant();error=$null}
    } catch { [PSCustomObject]@{job=$job;sha256='';error=$_.Exception.Message} }
} -ThrottleLimit 8)
$failures = @($results | Where-Object error)
if ($failures.Count) { throw (($failures | ForEach-Object { $_.job.archive + ': ' + $_.error }) -join "`n") }
$merged = [Collections.Generic.List[object]]::new()
foreach ($source in $index) { $merged.Add($source) }
$licenseRoot = Join-Path $root 'licenses\ocr\rust-crates'
foreach ($result in $results | Sort-Object { $_.job.archive }) {
    $job = $result.job
    if (-not ($merged | Where-Object archive -eq $job.archive)) {
        $merged.Add([ordered]@{name=$job.name;version=$job.version;url=$job.url;archive=$job.archive;sha256=$result.sha256;source_path=$job.source_path})
    }
    $archive = Join-Path $archiveDir $job.archive
    $entries = @(& tar -tf $archive)
    if ($LASTEXITCODE -ne 0) { throw "Cannot read Rust source archive: $archive" }
    $dest = Join-Path $licenseRoot ($job.archive -replace '\.(crate|tar\.gz)$','')
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    foreach ($entry in $entries | Where-Object { $_ -match '^[^/]+/(?:(?:LICENSE|LICENCE|COPYING|NOTICE|COPYRIGHT)(?:[._-][^/]*)?|Cargo\.toml)$' -and $_ -notmatch '/$' }) {
        $content = (& tar -xOf $archive $entry) -join "`n"
        if ($LASTEXITCODE -ne 0) { throw "Cannot read Rust notice: $entry" }
        [IO.File]::WriteAllText((Join-Path $dest ([IO.Path]::GetFileName($entry))), $content, [Text.UTF8Encoding]::new($false))
    }
}
$merged | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $indexPath -Encoding utf8
Copy-Item -LiteralPath $indexPath -Destination (Join-Path $root 'licenses\ocr\SOURCE_INDEX.json') -Force
Copy-Item -LiteralPath $indexPath -Destination (Join-Path $root 'windows\capture\SOURCE_INDEX.json') -Force
Write-Host "Locked Rust sources and notices ready: $($results.Count)."
