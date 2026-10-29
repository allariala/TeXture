# Builds TeXture.sln (Release) and the Inno Setup installer.
#   pwsh windows\installer\build.ps1
# Output: windows\installer\Output\TeXture_Install_v<version>.exe
# Needs the signing certificate in CurrentUser\My (create one with new-signing-cert.ps1).
param(
    [switch]$SkipOcrBuild,
    [string]$TimestampUrl = 'http://timestamp.digicert.com'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent   # repository root ("TeXture 2.0")
$iss = Join-Path $PSScriptRoot 'TeXture.iss'
$versionMatch = [regex]::Match([IO.File]::ReadAllText($iss), '#define AppVersion "([0-9.]+)"')
if (-not $versionMatch.Success) { throw 'AppVersion was not found in TeXture.iss.' }
$version = $versionMatch.Groups[1].Value
foreach ($requiredNotice in @('licenses\CC-BY-SA-4.0.txt','licenses\ocr\SOURCE_INDEX.json','windows\capture\LICENSE','windows\capture\MODEL_NOTICE.md')) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $requiredNotice))) {
        throw "Release license/source inventory is missing: $requiredNotice. Run windows/installer/prepare-release-source.ps1 in PowerShell 7 first."
    }
}

# Sign manifests and executables without installing the certificate into any trust store.
$csproj = Join-Path $root 'windows\PowerPoint\PowerLaTeX.csproj'
$thumb = ([xml](Get-Content $csproj)).Project.PropertyGroup.ManifestCertificateThumbprint | Where-Object { $_ } | Select-Object -First 1
$cert = Get-Item "Cert:\CurrentUser\My\$thumb" -ErrorAction SilentlyContinue
if (-not $cert -or -not $cert.HasPrivateKey) { throw "Signing certificate/private key $thumb not found in CurrentUser\My. Run windows\installer\new-signing-cert.ps1 first." }
$cer = Join-Path $PSScriptRoot 'assets\TeXture-signing.cer'
if (-not (Test-Path $cer) -or (New-Object Security.Cryptography.X509Certificates.X509Certificate2 $cer).Thumbprint -ne $thumb) {
    Export-Certificate -Cert $cert -FilePath $cer -Type CERT | Out-Null
}
$capture = Join-Path $root 'windows\capture'
$python = Join-Path $capture '.venv\Scripts\python.exe'
$model = Join-Path $capture 'texify_weights.pt'
if (-not (Test-Path $model)) { throw 'Run convert_model.py using the trusted legacy model first.' }
$modelHash = (Get-FileHash $model -Algorithm SHA256).Hash.ToLowerInvariant()
if ($SkipOcrBuild) {
    if (-not (Test-Path (Join-Path $capture 'dist\texture_capture\texture_capture.exe'))) {
        throw 'The existing OCR executable is required for -SkipOcrBuild.'
    }
    if ([IO.File]::ReadAllText((Join-Path $capture 'model_integrity.py')) -notmatch [regex]::Escape($modelHash)) {
        throw 'Model hash changed. Rebuild the OCR engine instead of using -SkipOcrBuild.'
    }
} else {
    if (-not (Test-Path $python)) { throw 'Create windows/capture/.venv and install the locked OCR requirements first.' }
    [IO.File]::WriteAllText((Join-Path $capture 'model_integrity.py'), "# SPDX-License-Identifier: GPL-3.0-or-later`nMODEL_SHA256 = '$modelHash'`n")
    Push-Location $capture
    try {
        & $python -m PyInstaller --noconfirm --clean texture_capture.spec
        if ($LASTEXITCODE -ne 0) { throw "OCR build failed ($LASTEXITCODE)" }
    } finally { Pop-Location }
}

$sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$signtool = Get-ChildItem $sdk -Filter signtool.exe -Recurse | Where-Object { $_.Directory.Name -eq 'x64' } |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $signtool) { throw 'Windows SDK signtool.exe is required.' }
& $signtool sign /sha1 $thumb /s My /fd SHA256 /tr $TimestampUrl /td SHA256 (Join-Path $capture 'dist\texture_capture\texture_capture.exe')
if ($LASTEXITCODE -ne 0) { throw 'OCR executable signing failed.' }

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -requires Microsoft.VisualStudio.Workload.Office -property installationPath
$msbuild = Join-Path $vs 'MSBuild\Current\Bin\MSBuild.exe'
& $msbuild (Join-Path $root 'TeXture.sln') /restore /t:Rebuild /p:Configuration=Release '/p:VSTOCleanDependsOn=' /p:RegisterAddinOnBuild=false "/p:ManifestTimestampUrl=$TimestampUrl" /nologo /v:m
if ($LASTEXITCODE -ne 0) { throw "MSBuild failed ($LASTEXITCODE)" }

$iscc = @(
    "$env:ProgramFiles\Inno Setup 7\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 7 or 6 is required.' }
$signCommand = '$q' + $signtool + '$q sign /sha1 ' + $thumb + ' /s My /fd SHA256 /tr $q' + $TimestampUrl + '$q /td SHA256 $f'
& $iscc /Qp "/Stexture=$signCommand" (Join-Path $PSScriptRoot 'TeXture.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }
Get-ChildItem (Join-Path $PSScriptRoot 'Output') -Filter *.exe | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
$installer = Join-Path $PSScriptRoot "Output\TeXture_Install_v$version.exe"
$digest = (Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$installer.sha256", "$digest  $([IO.Path]::GetFileName($installer))`n")
