# PowerShell 7. Downloads source archives, never installs or executes downloaded code.
# Run before build.ps1, then run -Finalize after the signed installer has been built.
param([switch]$Finalize, [switch]$ReplaceSourceArchive)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$version = [regex]::Match([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'TeXture.iss')), '#define AppVersion "([0-9.]+)"').Groups[1].Value
$output = Join-Path $PSScriptRoot 'Output'
$cache = Join-Path $PSScriptRoot '.release-cache'
$archives = Join-Path $cache 'sources'
$licenseRoot = Join-Path $root 'licenses\ocr'
$indexPath = Join-Path $cache 'source-index.json'
New-Item -ItemType Directory -Force -Path $output,$archives,$licenseRoot | Out-Null

function Save-Download([string]$Url, [string]$Destination, [string]$ExpectedHash = '') {
    if ((Test-Path -LiteralPath $Destination) -and ((-not $ExpectedHash) -or (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash -eq $ExpectedHash)) { return }
    $partial = $Destination + '.partial'
    Invoke-WebRequest -Uri $Url -OutFile $partial -TimeoutSec 120 -Headers @{'User-Agent'='TeXture-release-source/2.1.1'}
    if ($ExpectedHash -and (Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $ExpectedHash) {
        throw "Source archive hash mismatch: $Destination"
    }
    Move-Item -LiteralPath $partial -Destination $Destination -Force
}
function Add-Source([string]$Name, [string]$Version, [string]$Url, [string]$Filename, [string]$ExpectedHash = '', [string]$Path = '') {
    $destination = Join-Path $archives $Filename
    Save-Download $Url $destination $ExpectedHash
    $script:sources.Add([ordered]@{name=$Name;version=$Version;url=$Url;archive=$Filename;sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant();source_path=$Path})
    Write-Host "Source ready: $Name $Version"
}
function Add-GitHubSource([string]$Repo, [string]$Commit, [string]$SourcePath, [int]$Depth = 0) {
    if ($Depth -gt 8) { throw "Submodule nesting is too deep: $Repo" }
    if ($script:visited.Contains("$Repo@$Commit")) { return }
    [void]$script:visited.Add("$Repo@$Commit")
    $filename = ($Repo.Replace('/','-') + '-' + $Commit + '.tar.gz')
    Add-Source $Repo $Commit "https://codeload.github.com/$Repo/tar.gz/$Commit" $filename '' $SourcePath
    $archive = Join-Path $archives $filename
    $entries = @(& tar -tf $archive)
    if ($LASTEXITCODE -ne 0) { throw "Cannot list $archive" }
    $prefix = $entries[0].Split('/')[0]
    if ($entries -notcontains "$prefix/.gitmodules") { return }
    $moduleText = (& tar -xOf $archive "$prefix/.gitmodules") -join "`n"
    if (-not $moduleText.Trim()) { return }
    $treeCache = Join-Path $cache ($Repo.Replace('/','-') + '-' + $Commit + '-tree.json')
    Save-Download "https://api.github.com/repos/$Repo/git/trees/${Commit}?recursive=1" $treeCache
    $tree = Get-Content -LiteralPath $treeCache -Raw | ConvertFrom-Json
    if ($tree.truncated) { throw "Git tree was truncated for $Repo; submodule source inventory is incomplete." }
    foreach ($block in [regex]::Matches($moduleText, '(?ms)^\[submodule [^\]]+\]\s*(.*?)(?=^\[|\z)')) {
        $path = [regex]::Match($block.Groups[1].Value, '(?m)^\s*path\s*=\s*(.+)$').Groups[1].Value.Trim()
        $url = [regex]::Match($block.Groups[1].Value, '(?m)^\s*url\s*=\s*(.+)$').Groups[1].Value.Trim()
        $link = $tree.tree | Where-Object { $_.path -eq $path -and $_.mode -eq '160000' } | Select-Object -First 1
        if (-not $link) { continue } # Some .gitmodules entries are inactive in a release tree.
        if ($url.StartsWith('../')) { $url = 'https://github.com/' + $Repo.Split('/')[0] + '/' + $url.Substring(3) }
        $match = [regex]::Match($url, '^(?:https://github\.com/|git@github\.com:)([^/]+/[^/]+?)(?:\.git)?/?$')
        if (-not $match.Success) { throw "Source retrieval for submodule requires an explicit upstream: $url ($SourcePath/$path)" }
        Add-GitHubSource $match.Groups[1].Value $link.sha "$SourcePath/$path" ($Depth + 1)
    }
}

if (-not $Finalize) {
    $script:sources = [Collections.Generic.List[object]]::new()
    $script:visited = [Collections.Generic.HashSet[string]]::new()
    $pins = [ordered]@{}
    foreach ($line in Get-Content (Join-Path $root 'windows\capture\requirements-runtime.txt')) {
        if ($line -match '^([A-Za-z0-9_.-]+)==([^\s#]+)') { $pins[$Matches[1]] = $Matches[2] }
    }
    # Build tools and a vendored package visible in the actual distributed engine.
    $pins['texify']='0.2.1'; $pins['pyinstaller']='6.20.0'; $pins['pyinstaller-hooks-contrib']='2026.4'
    $pins['setuptools']='84.0.0'; $pins['importlib-metadata']='8.7.1'
    foreach ($name in $pins.Keys) {
        $pkgVersion = $pins[$name]
        $metadataFile = Join-Path $cache "$name-$pkgVersion-pypi.json"
        Save-Download "https://pypi.org/pypi/$name/$pkgVersion/json" $metadataFile
        $metadata = Get-Content -LiteralPath $metadataFile -Raw | ConvertFrom-Json
        $sdist = $metadata.urls | Where-Object packagetype -eq 'sdist' | Select-Object -First 1
        if ($sdist) { Add-Source $name $pkgVersion $sdist.url $sdist.filename $sdist.digests.sha256 }
        elseif ($name -eq 'torch') {
            $torchVersion = [IO.File]::ReadAllText((Join-Path $root 'windows\capture\dist\texture_capture\_internal\torch\version.py'))
            $commit = [regex]::Match($torchVersion, "git_version\s*=\s*'([0-9a-f]{40})'").Groups[1].Value
            if (-not $commit) { throw 'The distributed PyTorch source revision is unavailable.' }
            Add-GitHubSource 'pytorch/pytorch' $commit 'third-party/pytorch'
        } else { throw "No source distribution for $name $pkgVersion" }
    }
    $pythonVersion = (Get-Item (Join-Path $root 'windows\capture\dist\texture_capture\_internal\python313.dll')).VersionInfo.ProductVersion
    if ($pythonVersion -notmatch '^3\.13\.[0-9]+$') { throw "Unexpected bundled CPython version: $pythonVersion" }
    Add-Source 'CPython' $pythonVersion "https://www.python.org/ftp/python/$pythonVersion/Python-$pythonVersion.tgz" "Python-$pythonVersion.tgz"
    Add-GitHubSource 'OpenMathLib/OpenBLAS' 'v0.3.31' 'third-party/OpenBLAS'
    # Native libraries actually present in the inherited engine (not Python's default dependency versions).
    $sslVersion = (Get-Item (Join-Path $root 'windows\capture\dist\texture_capture\_internal\libssl-3-x64.dll')).VersionInfo.ProductVersion
    if ($sslVersion -ne '3.6.2') { throw "Re-inventory the bundled OpenSSL before release: $sslVersion" }
    Add-Source 'OpenSSL' '3.6.2' 'https://www.openssl.org/source/openssl-3.6.2.tar.gz' 'openssl-3.6.2.tar.gz'
    $sqlite = [Text.Encoding]::ASCII.GetString([IO.File]::ReadAllBytes((Join-Path $root 'windows\capture\dist\texture_capture\_internal\sqlite3.dll')))
    if (-not $sqlite.Contains('b270f8339eb13b504d0b2ba154ebca966b7dde08e40c3ed7d559749818cb2075')) { throw 'Re-inventory the bundled SQLite source revision before release.' }
    Add-Source 'SQLite' '3.51.2' 'https://www.sqlite.org/2026/sqlite-src-3510200.zip' 'sqlite-src-3510200.zip'
    Save-Download 'https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt' (Join-Path $root 'licenses\CC-BY-SA-4.0.txt')

    # Preserve complete license directories and public package metadata, without local direct_url/RECORD files.
    foreach ($base in @((Join-Path $root 'windows\capture\.venv\Lib\site-packages'), (Join-Path $root 'windows\capture\dist\texture_capture\_internal'))) {
        foreach ($info in Get-ChildItem -LiteralPath $base -Directory -Filter '*.dist-info') {
            $meta = Join-Path $info.FullName 'METADATA'
            if (-not (Test-Path -LiteralPath $meta)) { continue }
            $text = [IO.File]::ReadAllText($meta)
            $name = [regex]::Match($text, '(?m)^Name: (.+)\r?$').Groups[1].Value.Trim()
            $matched = $pins.Keys | Where-Object { ($_ -replace '[-_.]+','-') -eq ($name -replace '[-_.]+','-') } | Select-Object -First 1
            if (-not $matched) { continue }
            $dest = Join-Path $licenseRoot $info.Name
            foreach ($file in Get-ChildItem -LiteralPath $info.FullName -File -Recurse) {
                $relative = [IO.Path]::GetRelativePath($info.FullName, $file.FullName)
                if ($relative -notmatch '(?i)(^licenses?[/\\]|^METADATA$|(^|[/\\])(LICENSE|LICENCE|COPYING|NOTICE|COPYRIGHT|AUTHORS)([._-]|$))') { continue }
                $target = Join-Path $dest $relative
                New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
                Copy-Item -LiteralPath $file.FullName -Destination $target -Force
            }
        }
    }
    # Top-level upstream notices for packages whose dist-info was omitted by PyInstaller.
    foreach ($source in $script:sources) {
        $archive = Join-Path $archives $source.archive
        $entries = @(& tar -tf $archive)
        if ($LASTEXITCODE -ne 0) { throw "Cannot read source license files: $archive" }
        $destination = Join-Path $licenseRoot (($source.name -replace '[/\\]','-') + '-' + $source.version)
        foreach ($entry in $entries | Where-Object { $_ -match '^[^/]+/(?:LICENSE|LICENCE|COPYING|NOTICE|COPYRIGHT)(?:[._-][^/]*)?$' -and $_ -notmatch '/$' }) {
            New-Item -ItemType Directory -Force -Path $destination | Out-Null
            $licenseText = (& tar -xOf $archive $entry) -join "`n"
            if ($LASTEXITCODE -ne 0) { throw "Cannot read $entry" }
            [IO.File]::WriteAllText((Join-Path $destination ([IO.Path]::GetFileName($entry))), $licenseText, [Text.UTF8Encoding]::new($false))
        }
    }
    # Python's documentation carries the third-party notices for its Windows runtime.
    $pythonArchive = Join-Path $archives "Python-$pythonVersion.tgz"
    $pythonNotices = Join-Path $licenseRoot "CPython-$pythonVersion"
    foreach ($relative in @('Doc/license.rst','PC/crtlicense.txt')) {
        $content = (& tar -xOf $pythonArchive "Python-$pythonVersion/$relative") -join "`n"
        if ($LASTEXITCODE -ne 0) { throw "Cannot collect Python runtime notice $relative" }
        [IO.File]::WriteAllText((Join-Path $pythonNotices ([IO.Path]::GetFileName($relative))), $content, [Text.UTF8Encoding]::new($false))
    }
    $script:sources | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $indexPath -Encoding utf8
    Copy-Item -LiteralPath $indexPath -Destination (Join-Path $licenseRoot 'SOURCE_INDEX.json') -Force
    Write-Host 'Source acquisition and license collection complete. Build the installer, then run with -Finalize.'
    exit
}

if (-not (Test-Path -LiteralPath $indexPath)) { throw 'Run source acquisition before -Finalize.' }
$stage = Join-Path $output "TeXture_Source_v$version"
if (Test-Path -LiteralPath $stage) { throw "Source staging directory already exists: $stage (preserved for inspection)." }
New-Item -ItemType Directory -Path $stage | Out-Null
$files = @(& git -C $root ls-files --cached --others --exclude-standard)
if ($LASTEXITCODE -ne 0) { throw 'Cannot enumerate project source.' }
foreach ($relative in $files) {
    if ($relative -match '(?i)(^|/)(\.git|\.venv|bin|obj|dist|build|\.release-cache|Output)(/|$)|\.(pfx|pem|key|snk|exe|dll|pdb|pt|safetensors|pyc)$|\.csproj\.user$') { continue }
    # Maintainer-only publishing notes, local QA helpers and editor/agent settings are not source assets.
    if ($relative -match '(?i)^RELEASE_NOTES_.*\.md$|^RELEASE_UPLOAD\.md$|^\.gitignore$|^(windows/tests|\.codex|\.claude|\.agents|\.vscode)(/|$)|(^|/)(HANDOVER|SECURITY_REVIEW_LOCAL)\.md$|\.(suo|user|log)$') { continue }
    $from = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $from -PathType Leaf)) { continue }
    $to = Join-Path $stage $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $to -Parent) | Out-Null
    Copy-Item -LiteralPath $from -Destination $to
}
# Generated notices are intentionally ignored by Git but must remain in the source asset.
$noticeSource = Join-Path $root 'licenses\ocr'
$noticeDestination = Join-Path $stage 'licenses\ocr'
New-Item -ItemType Directory -Force -Path $noticeDestination | Out-Null
foreach ($notice in Get-ChildItem -LiteralPath $noticeSource) {
    Copy-Item -LiteralPath $notice.FullName -Destination $noticeDestination -Recurse -Force
}
$thirdParty = Join-Path $stage 'third-party-sources'
New-Item -ItemType Directory -Path $thirdParty | Out-Null
foreach ($source in (Get-Content -LiteralPath $indexPath -Raw | ConvertFrom-Json)) {
    $from = Join-Path $archives $source.archive
    if ((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash -ne $source.sha256) { throw "Cached source changed: $from" }
    Copy-Item -LiteralPath $from -Destination $thirdParty
}
Copy-Item -LiteralPath $indexPath -Destination (Join-Path $stage 'SOURCE_INDEX.json')
$gitTrees = Join-Path $thirdParty 'git-trees'
New-Item -ItemType Directory -Path $gitTrees | Out-Null
Get-ChildItem -LiteralPath $cache -File -Filter '*-tree.json' | Copy-Item -Destination $gitTrees
Copy-Item -LiteralPath (Join-Path $root 'windows\capture\texify_weights.pt') -Destination (Join-Path $stage 'windows\capture\texify_weights.pt')
$hashLines = foreach ($file in Get-ChildItem -LiteralPath $stage -File -Recurse | Sort-Object FullName) {
    (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + [IO.Path]::GetRelativePath($stage, $file.FullName).Replace([char]92, [char]47)
}
[IO.File]::WriteAllLines((Join-Path $stage 'SOURCE_FILES.sha256'), $hashLines, [Text.UTF8Encoding]::new($false))
$zip = Join-Path $output "TeXture_Source_v$version.zip"
if ((Test-Path -LiteralPath $zip) -and -not $ReplaceSourceArchive) { throw "Refusing to overwrite existing source archive without -ReplaceSourceArchive: $zip" }
# Never replace the release asset with a partial/empty ZIP if source staging fails.
if (-not (Test-Path -LiteralPath $stage -PathType Container)) { throw 'Source staging directory is missing.' }
$temporaryZip = Join-Path $output ("TeXture_Source_v$version-" + [Guid]::NewGuid().ToString('N') + '.tmp.zip')
[IO.Compression.ZipFile]::CreateFromDirectory($stage, $temporaryZip, [IO.Compression.CompressionLevel]::Fastest, $true)
$inspection = [IO.Compression.ZipFile]::OpenRead($temporaryZip)
try {
    foreach ($required in @('REBUILDING.md','SOURCE_AVAILABILITY.md','THIRD_PARTY_NOTICES.md','SOURCE_FILES.sha256','windows/capture/texture_capture.py','windows/capture/texify_weights.pt')) {
        if (-not $inspection.GetEntry("TeXture_Source_v$version/$required")) { throw "Incomplete source archive: $required" }
    }
} finally { $inspection.Dispose() }
Move-Item -LiteralPath $temporaryZip -Destination $zip -Force
$assets = @("TeXture_Install_v$version.exe", "TeXture_Source_v$version.zip")
$checksums = foreach ($asset in $assets) {
    (Get-FileHash -LiteralPath (Join-Path $output $asset) -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $asset
}
[IO.File]::WriteAllLines((Join-Path $output "SHA256SUMS_v$version.txt"), $checksums, [Text.UTF8Encoding]::new($false))
$releaseNotes = Join-Path $root "RELEASE_NOTES_v$version.md"
if (Test-Path -LiteralPath $releaseNotes) { Copy-Item -LiteralPath $releaseNotes -Destination $output -Force }
Write-Host "Release source archive: $zip"
