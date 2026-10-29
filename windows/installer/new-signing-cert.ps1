# Creates the release certificate that signs the VSTO manifests and wires it into the build.
#   pwsh windows\installer\new-signing-cert.ps1
#
# - Self-signed code-signing certificate valid for 10 years by default, stored in CurrentUser\My (private key stays
#   on this machine and is non-exportable; rebuilds must use this signing machine).
# - Public part exported to windows\installer\assets\TeXture-signing.cer (safe to commit).
# - ManifestCertificateThumbprint updated in both add-in projects.
# The installer does not add this certificate to any trust store. VSTO trusts the admin-installed,
# signed add-ins under Program Files. This is a signing identity, not a trust-store workaround.
param([ValidateRange(1, 30)][int]$ValidYears = 10)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

$cert = New-SelfSignedCertificate -Subject 'CN=TeXture Add-in Signing' -FriendlyName 'TeXture Add-in Signing' `
    -Type CodeSigningCert -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy NonExportable `
    -Provider 'Microsoft Enhanced RSA and AES Cryptographic Provider' -KeySpec Signature `
    -NotAfter (Get-Date).AddYears($ValidYears) -CertStoreLocation 'Cert:\CurrentUser\My' `
    -TextExtension @('2.5.29.19={critical}{text}ca=false')   # not a CA: it cannot issue other certificates

Export-Certificate -Cert $cert -FilePath (Join-Path $PSScriptRoot 'assets\TeXture-signing.cer') -Type CERT | Out-Null

foreach ($proj in 'windows\PowerPoint\PowerLaTeX.csproj', 'windows\Word\WordLaTeX.csproj') {
    $path = Join-Path $root $proj
    $text = [IO.File]::ReadAllText($path)
    $text = [regex]::Replace($text, '<ManifestCertificateThumbprint>[0-9A-Fa-f]+</ManifestCertificateThumbprint>',
        "<ManifestCertificateThumbprint>$($cert.Thumbprint)</ManifestCertificateThumbprint>")
    [IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($true)))
}
"Created $($cert.Subject)  thumbprint $($cert.Thumbprint)  valid until $($cert.NotAfter.ToString('yyyy-MM-dd'))"
