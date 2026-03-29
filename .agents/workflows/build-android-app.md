---
description: How to build the Android app manually from the terminal
---

To build the Android APK manually, follow these steps in your terminal:

1.  **Navigate to the Android project directory**:
    ```powershell
    cd d:\projects\call-log-tracker\android-app
    ```

2.  **Set the Java environment** (Required if `java` is not in your PATH or is the wrong version):
    // turbo
    ```powershell
    $env:JAVA_HOME = 'C:\openjdk\jdk-17.0.2'
    ```

3.  **Run the Gradle build command**:
    // turbo
    ```powershell
    .\gradlew assembleDebug
    ```

4.  **Locate your new APK**:
    Once the build finishes, you can find the APK here:
    `d:\projects\call-log-tracker\android-app\app\build\outputs\apk\debug\app-debug.apk`

---
> [!TIP]
> If you have **Android Studio** installed, you can also build by going to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
