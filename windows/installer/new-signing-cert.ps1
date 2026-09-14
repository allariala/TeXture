# Creates the long-lived certificate that signs the VSTO manifests and wires it into the build.
#   pwsh windows\installer\new-signing-cert.ps1
#
# - Self-signed code-signing certificate valid for 100 years, stored in CurrentUser\My (private key stays
#   on this machine; back it up with certmgr.msc -> Personal -> Certificates -> Export if you want).
# - Public part exported to windows\installer\assets\TeXture-signing.cer (safe to commit).
# - ManifestCertificateThumbprint updated in both add-in projects.
# The installer adds the public certificate to the machine's Trusted Publishers / Trusted Root stores, so
# the add-ins load for every user without a trust prompt and never run into certificate expiry.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

$cert = New-SelfSignedCertificate -Subject 'CN=TeXture Add-in Signing' -FriendlyName 'TeXture Add-in Signing' `
    -Type CodeSigningCert -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears(100) -CertStoreLocation 'Cert:\CurrentUser\My' `
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
