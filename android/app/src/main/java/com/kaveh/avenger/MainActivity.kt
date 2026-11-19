package com.kaveh.avenger

import android.os.Bundle
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.kaveh.avenger.auth.EmailOtpRepository
import com.kaveh.avenger.data.SupabaseClientProvider
import com.kaveh.avenger.ui.screens.AuthenticatedHomeScreen
import com.kaveh.avenger.ui.screens.ConfigurationRequiredScreen
import com.kaveh.avenger.ui.screens.EmailOtpScreen
import com.kaveh.avenger.ui.screens.LoadingScreen
import com.kaveh.avenger.ui.theme.KavehTheme
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.flow.collect
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(NotificationChannel("kaveh_general_notifications", "اعلان‌های کاوه", NotificationManager.IMPORTANCE_DEFAULT))
            manager.createNotificationChannel(NotificationChannel("kaveh_urgent_notifications", "اعلان‌های فوری کاوه", NotificationManager.IMPORTANCE_HIGH))
        }
        if (BuildConfig.FIREBASE_APP_ID.isNotBlank() && BuildConfig.FIREBASE_API_KEY.isNotBlank() && BuildConfig.FIREBASE_PROJECT_ID.isNotBlank() && BuildConfig.FIREBASE_SENDER_ID.isNotBlank() && FirebaseApp.getApps(this).isEmpty()) {
            val options = FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                .setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                .build()
            FirebaseApp.initializeApp(this, options)
        }
        setContent { KavehRoot() }
    }
}

@Composable
private fun KavehRoot() {
    KavehTheme {
        if (!SupabaseClientProvider.isConfigured) {
            ConfigurationRequiredScreen()
        } else {
            val supabase = remember { SupabaseClientProvider.client }
            val authRepository = remember { EmailOtpRepository(supabase) }
            var sessionStatus by remember { mutableStateOf<SessionStatus?>(null) }

            LaunchedEffect(supabase) {
                supabase.auth.sessionStatus.collect { sessionStatus = it }
            }

            when (val status = sessionStatus) {
                null, SessionStatus.Initializing -> LoadingScreen()
                is SessionStatus.Authenticated -> {
                    val user = status.session.user
                    val provider = user?.appMetadata?.get("provider")?.jsonPrimitive?.contentOrNull
                    val isGuest = user?.userMetadata?.get("access_method")?.jsonPrimitive?.contentOrNull == "shared_code"
                    val passwordReady = user?.userMetadata?.get("account_password_ready")?.jsonPrimitive?.booleanOrNull == true
                    if (provider == "email" && !isGuest && !passwordReady) {
                        EmailOtpScreen(
                            authRepository = authRepository,
                            initialEmail = user?.email.orEmpty(),
                            passwordSetupRequired = true
                        )
                    } else {
                        AuthenticatedHomeScreen(
                            email = user?.email,
                            userId = user?.id.orEmpty(),
                            onSignOut = { supabase.auth.signOut() }
                        )
                    }
                }
                is SessionStatus.NotAuthenticated -> EmailOtpScreen(authRepository)
                is SessionStatus.RefreshFailure -> EmailOtpScreen(
                    authRepository = authRepository,
                    initialMessage = "بازیابی نشست انجام نشد. دوباره کد ورود را درخواست کنید."
                )
            }
        }
    }
}
