# Builds TeXture.sln (Release) and the Inno Setup installer.
#   pwsh windows\installer\build.ps1
# Output: windows\installer\Output\TeXture_Install_v<version>.exe
# Needs the signing certificate in CurrentUser\My (create one with new-signing-cert.ps1).
param([switch]$SkipOcrBuild)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent   # repository root ("TeXture 2.0")

# Sign manifests and executables without installing the certificate into any trust store.
$csproj = Join-Path $root 'windows\PowerPoint\PowerLaTeX.csproj'
$thumb = ([xml](Get-Content $csproj)).Project.PropertyGroup.ManifestCertificateThumbprint | Where-Object { $_ } | Select-Object -First 1
$cert = Get-Item "Cert:\CurrentUser\My\$thumb" -ErrorAction SilentlyContinue
if (-not $cert) { throw "Signing certificate $thumb not found in CurrentUser\My. Run windows\installer\new-signing-cert.ps1 first." }
$cer = Join-Path $PSScriptRoot 'assets\TeXture-signing.cer'
if (-not (Test-Path $cer) -or (New-Object Security.Cryptography.X509Certificates.X509Certificate2 $cer).Thumbprint -ne $thumb) {
    Export-Certificate -Cert $cert -FilePath $cer -Type CERT | Out-Null
}
$capture = Join-Path $root 'windows\capture'
$python = Join-Path $capture '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw 'Create windows/capture/.venv and install the locked OCR requirements first.' }
$model = Join-Path $capture 'texify_weights.pt'
if (-not (Test-Path $model)) { throw 'Run convert_model.py using the trusted legacy model first.' }
$modelHash = (Get-FileHash $model -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $capture 'model_integrity.py'), "MODEL_SHA256 = '$modelHash'`n")
if (-not $SkipOcrBuild) {
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
& $signtool sign /sha1 $thumb /s My /fd SHA256 (Join-Path $capture 'dist\texture_capture\texture_capture.exe')
if ($LASTEXITCODE -ne 0) { throw 'OCR executable signing failed.' }

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -requires Microsoft.VisualStudio.Workload.Office -property installationPath
$msbuild = Join-Path $vs 'MSBuild\Current\Bin\MSBuild.exe'
& $msbuild (Join-Path $root 'TeXture.sln') /restore /t:Rebuild /p:Configuration=Release /nologo /v:m
if ($LASTEXITCODE -ne 0) { throw "MSBuild failed ($LASTEXITCODE)" }

$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$signCommand = '$q' + $signtool + '$q sign /sha1 ' + $thumb + ' /s My /fd SHA256 $f'
& $iscc /Qp "/Stexture=$signCommand" (Join-Path $PSScriptRoot 'TeXture.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }
Get-ChildItem (Join-Path $PSScriptRoot 'Output') -Filter *.exe | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
$installer = Join-Path $PSScriptRoot 'Output\TeXture_Install_v2.1.0.exe'
$digest = (Get-FileHash $installer -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$installer.sha256", "$digest  $([IO.Path]::GetFileName($installer))`n")
