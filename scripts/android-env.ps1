# Loads JAVA_HOME / ANDROID_HOME for Capacitor and emulator (current session).
$candidates = @(
  "C:\Program Files\Android\Android Studio\jbr",
  "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
  "$env:ProgramFiles\Android\Android Studio\jbr"
)

$javaHome = $null
foreach ($path in $candidates) {
  if (Test-Path "$path\bin\java.exe") {
    $javaHome = $path
    break
  }
}

$sdkHome = Join-Path $env:LOCALAPPDATA "Android\Sdk"

if (-not $javaHome) {
  Write-Error "JDK do Android Studio nao encontrado. Instale o Android Studio."
  exit 1
}
if (-not (Test-Path "$sdkHome\platform-tools\adb.exe")) {
  Write-Error "Android SDK nao encontrado em $sdkHome."
  exit 1
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkHome
$env:ANDROID_SDK_ROOT = $sdkHome
$env:Path = (@(
  "$javaHome\bin",
  "$sdkHome\platform-tools",
  "$sdkHome\emulator",
  "$sdkHome\cmdline-tools\latest\bin"
) -join ';') + ';' + $env:Path

Write-Host "ANDROID_HOME=$env:ANDROID_HOME"
Write-Host "JAVA_HOME=$env:JAVA_HOME"
