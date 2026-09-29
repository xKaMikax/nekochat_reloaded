import java.util.Properties

plugins {
    id("com.android.application")
}

// Release signing key: keystore.properties next to settings.gradle.kts (not in git) with
// storeFile, storePassword, keyAlias and keyPassword. Without it, release builds fall back
// to the debug key.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "dev.kamika.nekochat_reloaded"
    compileSdk = 36

    defaultConfig {
        applicationId = "dev.kamika.nekochat_reloaded"
        minSdk = 26
        targetSdk = 36
        versionCode = 15
        versionName = "1.4.3-beta-2"
    }

    signingConfigs {
        if (keystoreProperties.getProperty("storeFile") != null) {
            create("release") {
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}


dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.webkit:webkit:1.14.0")
}
