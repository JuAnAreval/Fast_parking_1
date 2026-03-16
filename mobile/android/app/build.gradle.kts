import java.io.ByteArrayOutputStream
import java.io.File

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val apiPort =
    (project.findProperty("apiPort") as String?)
        ?.toIntOrNull()
        ?: System.getenv("API_PORT")?.toIntOrNull()
        ?: 3000

fun resolveAdbExecutable(): String {
    val isWindows = System.getProperty("os.name").contains("Windows", ignoreCase = true)
    val adbName = if (isWindows) "adb.exe" else "adb"

    val localPropertiesFile = rootProject.file("local.properties")
    val sdkDirFromLocalProperties =
        if (localPropertiesFile.exists()) {
            localPropertiesFile
                .readLines()
                .firstOrNull { it.startsWith("sdk.dir=") }
                ?.substringAfter("sdk.dir=")
                ?.replace("\\\\", "\\")
        } else {
            null
        }

    val sdkDir =
        sdkDirFromLocalProperties
            ?: System.getenv("ANDROID_SDK_ROOT")
            ?: System.getenv("ANDROID_HOME")

    if (sdkDir != null) {
        val adbFromSdk = File(sdkDir, "platform-tools/$adbName")
        if (adbFromSdk.exists()) return adbFromSdk.absolutePath
    }

    return adbName
}

data class CommandResult(
    val exitCode: Int,
    val output: String,
)

fun runAdbCommand(adb: String, vararg args: String): CommandResult? {
    val output = ByteArrayOutputStream()
    return runCatching {
        val execResult =
            exec {
                commandLine(adb, *args)
                standardOutput = output
                errorOutput = output
                isIgnoreExitValue = true
            }
        CommandResult(execResult.exitValue, output.toString().trim())
    }
        .getOrNull()
}

val configureAdbReverse by tasks.registering {
    group = "development"
    description = "Configura adb reverse para API local en Android por USB"

    doLast {
        val adb = resolveAdbExecutable()
        val startResult = runAdbCommand(adb, "start-server")
        if (startResult == null || startResult.exitCode != 0) {
            logger.warn("No se pudo ejecutar adb. Se omite la configuracion de adb reverse.")
            return@doLast
        }

        val devicesOutput = runAdbCommand(adb, "devices")
        if (devicesOutput == null || devicesOutput.exitCode != 0) {
            logger.warn("No se pudo listar dispositivos con adb. Se omite adb reverse.")
            return@doLast
        }

        val serials =
            devicesOutput.output
                .lineSequence()
                .drop(1)
                .map { it.trim() }
                .filter { it.isNotEmpty() && it.endsWith("\tdevice") }
                .map { it.substringBefore('\t') }
                .toList()

        if (serials.isEmpty()) {
            logger.lifecycle("No hay dispositivos Android conectados por USB. Se omite adb reverse.")
            return@doLast
        }

        serials.forEach { serial ->
            val reverseResult =
                runAdbCommand(adb, "-s", serial, "reverse", "tcp:$apiPort", "tcp:$apiPort")
            if (reverseResult == null || reverseResult.exitCode != 0) {
                logger.warn("No se pudo aplicar adb reverse para $serial. ${reverseResult?.output ?: ""}")
            } else {
                logger.lifecycle("adb reverse activo para $serial -> tcp:$apiPort")
            }
        }
    }
}

android {
    namespace = "com.parqueaderos.usuarios"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.parqueaderos.usuarios"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}

tasks.matching { it.name == "preDebugBuild" }.configureEach {
    dependsOn(configureAdbReverse)
}
