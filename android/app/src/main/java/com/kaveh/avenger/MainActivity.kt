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
                is SessionStatus.Authenticated -> AuthenticatedHomeScreen(
                    email = status.session.user?.email,
                    userId = status.session.user?.id.orEmpty(),
                    onSignOut = { supabase.auth.signOut() }
                )
                is SessionStatus.NotAuthenticated -> EmailOtpScreen(authRepository)
                is SessionStatus.RefreshFailure -> EmailOtpScreen(
                    authRepository = authRepository,
                    initialMessage = "بازیابی نشست انجام نشد. دوباره کد ورود را درخواست کنید."
                )
            }
        }
    }
}
