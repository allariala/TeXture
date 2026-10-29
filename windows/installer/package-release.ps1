# PowerShell 7: make the source/notices, signed installer, and matching source asset together.
param([switch]$SkipOcrBuild, [string]$TimestampUrl = 'http://timestamp.digicert.com')
$ErrorActionPreference = 'Stop'
& pwsh.exe -NoProfile -File (Join-Path $PSScriptRoot 'prepare-release-source.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Source/license preparation failed; release packaging stopped.' }
& pwsh.exe -NoProfile -File (Join-Path $PSScriptRoot 'prepare-rust-sources.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Locked Rust dependency sources are incomplete.' }
$arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $PSScriptRoot 'build.ps1'),'-TimestampUrl',$TimestampUrl)
if ($SkipOcrBuild) { $arguments += '-SkipOcrBuild' }
& powershell.exe @arguments
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }
& pwsh.exe -NoProfile -File (Join-Path $PSScriptRoot 'prepare-release-source.ps1') -Finalize
if ($LASTEXITCODE -ne 0) { throw 'Matching release source archive was not completed.' }
