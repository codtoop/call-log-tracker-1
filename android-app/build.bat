@echo off
set JAVA_HOME=C:\openjdk\jdk-17.0.2
echo Using JAVA_HOME: %JAVA_HOME%
cmd /c gradlew.bat assembleDebug
