; TeXture installer (PowerPoint + Word + offline OCR engine).
; Build with installer\build.ps1 (builds OCR + signed VSTO manifests and runs ISCC with signing).
;
; Differences from the v1.2.3 installer:
;  - Registry-based VSTO deployment (|vstolocal) instead of chaining two ClickOnce setup.exe files.
;  - No changes to the machine-wide .NET TrustManager prompting levels (v1.2.3 enabled them for
;    Internet/UntrustedSites). VSTO trusts the protected Program Files deployment location.
;  - Never kills PowerPoint/Word: asks the user to close them.
;  - Real uninstaller (Apps & features), removes registry entries and files.

#define AppVersion "2.1.0"
#define Root "..\.."
#define Assets "assets"
#define PptBin "..\PowerPoint\bin\Release"
#define WordBin "..\Word\bin\Release"
#define Capture "..\capture"
#define PptName "TeXture (PowerPoint)"
#define WordName "TeXture (Word)"

[Setup]
AppId={{8D4C2A7E-5B1F-4E3A-9C6D-7F2E1A0B3C4D}
AppName=TeXture
AppVersion={#AppVersion}
AppVerName=TeXture {#AppVersion}
AppPublisher=Allariala
AppSupportURL=https://allariala.github.io/TeXture/
DefaultDirName={autopf}\TeXture
DisableProgramGroupPage=yes
DisableDirPage=yes
UsePreviousAppDir=no
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=Output
OutputBaseFilename=TeXture_Install_v{#AppVersion}
SetupIconFile={#Assets}\TeXture_icon.ico
LicenseFile={#Root}\LICENSE
UninstallDisplayIcon={app}\TeXture_icon.ico
UninstallDisplayName=TeXture {#AppVersion} (PowerPoint & Word)
Compression=lzma2/fast
SolidCompression=no
WizardStyle=modern
CloseApplications=yes
CloseApplicationsFilter=texture_capture.exe
RestartApplications=no
SignTool=texture
SignedUninstaller=yes

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[InstallDelete]
; Leftovers of the v1.2.x layout (the OCR engine folder is replaced as a whole).
Type: filesandordirs; Name: "{app}\capture_server"

[Files]
Source: "{#Assets}\TeXture_icon.ico"; DestDir: "{app}"; Flags: ignoreversion
; Public signing certificate for inspecting signatures; never registered as a trust anchor.
Source: "{#Assets}\TeXture-signing.cer"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Root}\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Root}\THIRD_PARTY_NOTICES.md"; DestDir: "{app}"; Flags: ignoreversion
; PowerPoint add-in (assembly, VSTO manifests, WebView2, shared UI)
Source: "{#PptBin}\*.dll"; DestDir: "{app}\PowerPoint"; Flags: ignoreversion
Source: "{#PptBin}\*.manifest"; DestDir: "{app}\PowerPoint"; Flags: ignoreversion
Source: "{#PptBin}\*.vsto"; DestDir: "{app}\PowerPoint"; Flags: ignoreversion
Source: "{#PptBin}\runtimes\*"; DestDir: "{app}\PowerPoint\runtimes"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PptBin}\ui\*"; DestDir: "{app}\PowerPoint\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
; Word add-in
Source: "{#WordBin}\*.dll"; DestDir: "{app}\Word"; Flags: ignoreversion
Source: "{#WordBin}\*.manifest"; DestDir: "{app}\Word"; Flags: ignoreversion
Source: "{#WordBin}\*.vsto"; DestDir: "{app}\Word"; Flags: ignoreversion
Source: "{#WordBin}\runtimes\*"; DestDir: "{app}\Word\runtimes"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#WordBin}\ui\*"; DestDir: "{app}\Word\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
; Offline OCR engine (PyInstaller build of windows\capture, GPL-3.0 because it bundles texify; see
; THIRD_PARTY_NOTICES.md). Binaries are not in git: build them or copy them into windows\capture (see README).
Source: "{#Capture}\dist\texture_capture\*"; DestDir: "{app}\capture_server"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#Capture}\texify_weights.pt"; DestDir: "{app}\capture_server"; Flags: ignoreversion
Source: "{#Capture}\models\*.json"; DestDir: "{app}\capture_server\models"; Flags: ignoreversion

[Registry]
; Install location (the add-ins use it to find the OCR engine).
Root: HKLM64; Subkey: "SOFTWARE\TeXture"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: uninsdeletekey; Check: IsWin64
Root: HKLM32; Subkey: "SOFTWARE\TeXture"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: uninsdeletekey

; All-users add-in registration, for 64-bit and 32-bit Office.
Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: string; ValueName: "FriendlyName"; ValueData: "{#PptName}"; Flags: uninsdeletekey; Check: IsWin64
Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: string; ValueName: "Description"; ValueData: "LaTeX Editor for PowerPoint"; Check: IsWin64
Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: dword; ValueName: "LoadBehavior"; ValueData: "3"; Check: IsWin64
Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: string; ValueName: "Manifest"; ValueData: "{code:ManifestUrl|PowerPoint\{#PptName}.vsto}|vstolocal"; Check: IsWin64
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: string; ValueName: "FriendlyName"; ValueData: "{#PptName}"; Flags: uninsdeletekey
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: string; ValueName: "Description"; ValueData: "LaTeX Editor for PowerPoint"
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: dword; ValueName: "LoadBehavior"; ValueData: "3"
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\PowerPoint\Addins\{#PptName}"; ValueType: string; ValueName: "Manifest"; ValueData: "{code:ManifestUrl|PowerPoint\{#PptName}.vsto}|vstolocal"

Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: string; ValueName: "FriendlyName"; ValueData: "{#WordName}"; Flags: uninsdeletekey; Check: IsWin64
Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: string; ValueName: "Description"; ValueData: "LaTeX Editor for Word"; Check: IsWin64
Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: dword; ValueName: "LoadBehavior"; ValueData: "3"; Check: IsWin64
Root: HKLM64; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: string; ValueName: "Manifest"; ValueData: "{code:ManifestUrl|Word\{#WordName}.vsto}|vstolocal"; Check: IsWin64
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: string; ValueName: "FriendlyName"; ValueData: "{#WordName}"; Flags: uninsdeletekey
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: string; ValueName: "Description"; ValueData: "LaTeX Editor for Word"
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: dword; ValueName: "LoadBehavior"; ValueData: "3"
Root: HKLM32; Subkey: "SOFTWARE\Microsoft\Office\Word\Addins\{#WordName}"; ValueType: string; ValueName: "Manifest"; ValueData: "{code:ManifestUrl|Word\{#WordName}.vsto}|vstolocal"

; VSTO trusts the signed add-ins installed by an administrator under Program Files.
; No publisher-wide trust and no certificate-store additions are required.
[Run]
; Remove only the legacy TeXture certificate trust, including when upgrading an older install.
Filename: "{sys}\certutil.exe"; Parameters: "-delstore TrustedPublisher AB15CFDF39844FCABC3564B7B87182C7EDEA3CD2"; Flags: runhidden waituntilterminated
Filename: "{sys}\certutil.exe"; Parameters: "-delstore Root AB15CFDF39844FCABC3564B7B87182C7EDEA3CD2"; Flags: runhidden waituntilterminated
[UninstallDelete]
Type: files; Name: "{app}\TeXture-signing.cer"

[Code]
function ManifestUrl(Param: String): String;
var
  P: String;
begin
  P := ExpandConstant('{app}\') + Param;
  StringChangeEx(P, '\', '/', True);
  Result := 'file:///' + P;
end;

function IsProcessRunning(ExeName: String): Boolean;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{cmd}'), '/c tasklist /FI "IMAGENAME eq ' + ExeName + '" | find /I "' + ExeName + '"',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := ResultCode = 0;
end;

function VstoRuntimeInstalled(): Boolean;
begin
  Result := RegKeyExists(HKLM64, 'SOFTWARE\Microsoft\VSTO Runtime Setup\v4R') or
            RegKeyExists(HKLM32, 'SOFTWARE\Microsoft\VSTO Runtime Setup\v4R') or
            RegKeyExists(HKLM64, 'SOFTWARE\Microsoft\VSTO Runtime Setup\v4') or
            RegKeyExists(HKLM32, 'SOFTWARE\Microsoft\VSTO Runtime Setup\v4');
end;

function WebView2Installed(): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(HKLM32, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) or
            RegQueryStringValue(HKLM64, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version) or
            RegQueryStringValue(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}', 'pv', Version);
  Result := Result and (Version <> '') and (Version <> '0.0.0.0');
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
  if not VstoRuntimeInstalled() then
    MsgBox('Visual Studio 2010 Tools for Office Runtime이 설치되어 있지 않은 것 같습니다.' + #13#10 +
           '설치는 계속되지만, 추가 기능이 로드되지 않으면 Microsoft에서 "VSTO Runtime"을 설치해 주세요.',
           mbInformation, MB_OK);
  if not WebView2Installed() then
    MsgBox('Microsoft Edge WebView2 런타임이 설치되어 있지 않은 것 같습니다.' + #13#10 +
           '편집기 화면을 표시하려면 WebView2 런타임(Evergreen)을 설치해 주세요.',
           mbInformation, MB_OK);
end;

// Keep the security explanation visible without importing a global signing authority.
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := MemoDirInfo + NewLine + NewLine +
    'Security / 보안:' + NewLine +
    Space + 'Signed Office add-ins are installed in Program Files for all users.' + NewLine +
    Space + 'No certificates are added to Trusted Root or Trusted Publishers.' + NewLine +
    Space + '추가 기능은 Program Files에 설치되며 루트/게시자 인증서를 등록하지 않습니다.';
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  // Even a command-line /DIR override must not bypass the protected-location trust boundary.
  if CompareText(RemoveBackslashUnlessRoot(ExpandConstant('{app}')),
                 RemoveBackslashUnlessRoot(ExpandConstant('{autopf}\TeXture'))) <> 0 then
  begin
    Result := 'TeXture must be installed in Program Files\TeXture.';
    Exit;
  end;
  // Never close Office on the user's behalf: unsaved work would be lost.
  if IsProcessRunning('POWERPNT.EXE') or IsProcessRunning('WINWORD.EXE') then
  begin
    Result := 'PowerPoint 또는 Word가 실행 중입니다.' + #13#10 +
              '작업을 저장하고 두 프로그램을 모두 종료한 뒤 [뒤로] → [다음]을 눌러 다시 시도해 주세요.';
    Exit;
  end;
end;

function InitializeUninstall(): Boolean;
begin
  Result := not (IsProcessRunning('POWERPNT.EXE') or IsProcessRunning('WINWORD.EXE'));
  if not Result then
    MsgBox('작업을 저장하고 PowerPoint와 Word를 종료한 뒤 제거해 주세요.' + #13#10 +
           'Save your work and close PowerPoint and Word before uninstalling.', mbInformation, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssInstall then
  begin
    RegDeleteKeyIncludingSubkeys(HKCU, 'Software\Microsoft\VSTO\Security\Inclusion\{3C1B7E52-9A4D-4F61-8B2E-6D0A5C9F1E73}');
    RegDeleteKeyIncludingSubkeys(HKCU, 'Software\Microsoft\VSTO\Security\Inclusion\{7F4A9D10-2C6B-4E85-A1D3-9B5E0C7F2A64}');
    // Restart Manager handles only the installed engine; never kill a process by name.
    // Per-user registrations of v1.2.x (ClickOnce) would override the new all-users registration.
    RegDeleteKeyIncludingSubkeys(HKCU, 'Software\Microsoft\Office\PowerPoint\Addins\{#PptName}');
    RegDeleteKeyIncludingSubkeys(HKCU, 'Software\Microsoft\Office\Word\Addins\{#WordName}');
    RegDeleteKeyIncludingSubkeys(HKCU, 'Software\Microsoft\Office\PowerPoint\Addins\PowerLaTeX');
    RegDeleteKeyIncludingSubkeys(HKCU, 'Software\Microsoft\Office\Word\Addins\WordLaTeX');
  end;
end;
