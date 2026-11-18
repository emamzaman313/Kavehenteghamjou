package com.kaveh.avenger

import android.os.Bundle
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
