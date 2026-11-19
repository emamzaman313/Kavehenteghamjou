import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use(::load)
}
fun localValue(key: String): String = localProperties.getProperty(key, "")
fun asBuildConfig(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

// Release signing is configured only from local.properties (never committed).
// CI writes these properties from encrypted GitHub Actions secrets.
val releaseStoreFile = localValue("ANDROID_KEYSTORE_PATH")
val releaseStorePassword = localValue("ANDROID_KEYSTORE_PASSWORD")
val releaseKeyAlias = localValue("ANDROID_KEY_ALIAS")
val releaseKeyPassword = localValue("ANDROID_KEY_PASSWORD")
val releaseSigningConfigured = listOf(
    releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword
).all { it.isNotBlank() } && file(releaseStoreFile).exists()

// Keep the AndroidX Lifecycle artifacts aligned to the last release compatible
// with this application's compileSdk 36. Lifecycle 2.11.0 requires API 37.
configurations.configureEach {
    resolutionStrategy.eachDependency {
        if (requested.group == "androidx.lifecycle") {
            useVersion("2.10.0")
            because("The app deliberately compiles against the stable Android SDK 36")
        }
    }
}

android {
    namespace = "com.kaveh.avenger"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.kaveh.avenger"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "SUPABASE_URL", asBuildConfig(localValue("SUPABASE_URL")))
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", asBuildConfig(localValue("SUPABASE_PUBLISHABLE_KEY")))
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", asBuildConfig(localValue("GOOGLE_WEB_CLIENT_ID")))
        buildConfigField("String", "FIREBASE_APP_ID", asBuildConfig(localValue("FIREBASE_APP_ID")))
        buildConfigField("String", "FIREBASE_API_KEY", asBuildConfig(localValue("FIREBASE_API_KEY")))
        buildConfigField("String", "FIREBASE_PROJECT_ID", asBuildConfig(localValue("FIREBASE_PROJECT_ID")))
        buildConfigField("String", "FIREBASE_SENDER_ID", asBuildConfig(localValue("FIREBASE_SENDER_ID")))
    }

    signingConfigs {
        create("release") {
            if (releaseSigningConfigured) {
                storeFile = file(releaseStoreFile)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (releaseSigningConfigured) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}


dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.06.01"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Native Google identity flow (no WebView)
    implementation("androidx.credentials:credentials:1.6.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.2.1")

    // Supabase Kotlin SDK: authentication, database, storage and realtime
    implementation(platform("io.github.jan-tennert.supabase:bom:3.9.0"))
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")
    implementation("io.github.jan-tennert.supabase:realtime-kt")
    implementation("io.ktor:ktor-client-android:3.4.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.9.0")
    implementation(platform("com.google.firebase:firebase-bom:35.2.0"))
    implementation("com.google.firebase:firebase-messaging")

    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
