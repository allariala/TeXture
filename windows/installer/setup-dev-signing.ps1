# Creates/reuses a local development signing certificate for F5 debugging.
# Only ignored .csproj.user files are changed, and only for Debug builds.
# Release signing and Windows trusted root/publisher stores are left unchanged.
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$subject = 'CN=TeXture Local Development'
$now = Get-Date
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
    Where-Object { $_.Subject -eq $subject -and $_.HasPrivateKey -and $_.NotBefore -le $now -and $_.NotAfter -gt $now.AddDays(30) } |
    Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $cert) {
    $cert = New-SelfSignedCertificate -Subject $subject -FriendlyName 'TeXture Local Development' `
        -Type CodeSigningCert -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 `
        -Provider 'Microsoft Enhanced RSA and AES Cryptographic Provider' -KeySpec Signature `
        -KeyExportPolicy NonExportable -NotAfter $now.AddYears(2) -CertStoreLocation Cert:\CurrentUser\My `
        -TextExtension @('2.5.29.19={critical}{text}ca=false')
}

$ns = 'http://schemas.microsoft.com/developer/msbuild/2003'
foreach ($relative in 'windows\Word\WordLaTeX.csproj.user', 'windows\PowerPoint\PowerLaTeX.csproj.user') {
    $path = Join-Path $root $relative
    $xml = New-Object System.Xml.XmlDocument
    if (Test-Path -LiteralPath $path) { $xml.Load($path) }
    else { $xml.LoadXml('<Project ToolsVersion="Current" xmlns="http://schemas.microsoft.com/developer/msbuild/2003" />') }
    $group = $xml.DocumentElement.ChildNodes | Where-Object {
        $_.LocalName -eq 'PropertyGroup' -and $_.GetAttribute('Label') -eq 'TeXtureLocalDevelopmentSigning'
    } | Select-Object -First 1
    if (-not $group) {
        $group = $xml.CreateElement('PropertyGroup', $ns)
        $group.SetAttribute('Label', 'TeXtureLocalDevelopmentSigning')
        [void]$xml.DocumentElement.AppendChild($group)
    }
    $group.SetAttribute('Condition', "'`$(Configuration)' == 'Debug'")
    foreach ($entry in @{
        SignManifests = 'true'
        ManifestCertificateThumbprint = $cert.Thumbprint
        ManifestKeyFile = ''
    }.GetEnumerator()) {
        $node = $group.ChildNodes | Where-Object { $_.LocalName -eq $entry.Key } | Select-Object -First 1
        if (-not $node) {
            $node = $xml.CreateElement($entry.Key, $ns)
            [void]$group.AppendChild($node)
        }
        $node.InnerText = $entry.Value
    }
    $xml.Save($path)
    Write-Output "Configured Debug signing: $relative"
}
Write-Output "Development certificate: $($cert.Thumbprint), expires $($cert.NotAfter.ToString('yyyy-MM-dd'))"
Write-Output 'Release signing and trusted root/publisher stores were not modified. Reload the projects in Visual Studio.'
