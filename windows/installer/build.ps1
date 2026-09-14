# Builds TeXture.sln (Release) and the Inno Setup installer.
#   pwsh windows\installer\build.ps1
# Output: windows\installer\Output\TeXture_Install_v<version>.exe
# Needs the signing certificate in CurrentUser\My (create one with new-signing-cert.ps1).
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent   # repository root ("TeXture 2.0")

# The manifest-signing certificate: its public key feeds the VSTO inclusion list, its thumbprint lets the
# uninstaller remove the machine-wide trust entries again.
$csproj = Join-Path $root 'windows\PowerPoint\PowerLaTeX.csproj'
$thumb = ([xml](Get-Content $csproj)).Project.PropertyGroup.ManifestCertificateThumbprint | Where-Object { $_ } | Select-Object -First 1
$cert = Get-Item "Cert:\CurrentUser\My\$thumb" -ErrorAction SilentlyContinue
if (-not $cert) { throw "Signing certificate $thumb not found in CurrentUser\My. Run windows\installer\new-signing-cert.ps1 first." }
$cer = Join-Path $PSScriptRoot 'assets\TeXture-signing.cer'
if (-not (Test-Path $cer) -or (New-Object Security.Cryptography.X509Certificates.X509Certificate2 $cer).Thumbprint -ne $thumb) {
    Export-Certificate -Cert $cert -FilePath $cer -Type CERT | Out-Null
}
$key = $cert.PublicKey.GetRSAPublicKey().ToXmlString($false)
@"
#define PptPublicKey "$key"
#define WordPublicKey "$key"
#define CertThumbprint "$thumb"
"@ | Set-Content -Encoding utf8 (Join-Path $PSScriptRoot 'keys.generated.iss')

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -requires Microsoft.VisualStudio.Workload.Office -property installationPath
$msbuild = Join-Path $vs 'MSBuild\Current\Bin\MSBuild.exe'
& $msbuild (Join-Path $root 'TeXture.sln') /restore /t:Rebuild /p:Configuration=Release /nologo /v:m
if ($LASTEXITCODE -ne 0) { throw "MSBuild failed ($LASTEXITCODE)" }

$iscc = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
& $iscc (Join-Path $PSScriptRoot 'TeXture.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC failed ($LASTEXITCODE)" }
Get-ChildItem (Join-Path $PSScriptRoot 'Output') -Filter *.exe | Select-Object Name, @{n='MB';e={[math]::Round($_.Length/1MB,1)}}
