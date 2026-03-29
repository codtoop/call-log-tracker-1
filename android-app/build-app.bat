@echo off
set JAVA_HOME=C:\openjdk\jdk-17.0.2
cd /d d:\projects\call-log-tracker\android-app
echo Building Android App...
call gradlew assembleDebug
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b %errorlevel%
)
echo Build Successful!
echo APK is at: d:\projects\call-log-tracker\android-app\app\build\outputs\apk\debug\app-debug.apk
pause
