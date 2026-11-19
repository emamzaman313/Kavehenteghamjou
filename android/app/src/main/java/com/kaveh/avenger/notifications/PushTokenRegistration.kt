package com.kaveh.avenger.notifications

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.rpc
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
private data class RegisterPushTokenArgs(
    @SerialName("p_token") val token: String,
    @SerialName("p_platform") val platform: String = "android",
    @SerialName("p_device_label") val deviceLabel: String
)

@Composable
fun PushTokenRegistration(supabase: SupabaseClient, userId: String) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val registerToken: () -> Unit = {
        if (FirebaseApp.getApps(context).isNotEmpty()) {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                if (token.isNotBlank()) {
                    scope.launch {
                        try {
                            supabase.postgrest.rpc(
                                "register_device_token",
                                RegisterPushTokenArgs(token = token, deviceLabel = Build.MODEL ?: "Android")
                            )
                        } catch (_: Exception) {
                            // Push delivery remains optional until Firebase server credentials are configured.
                        }
                    }
                }
            }
        }
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) registerToken() }

    LaunchedEffect(userId) {
        if (FirebaseApp.getApps(context).isEmpty()) return@LaunchedEffect
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            registerToken()
        }
    }
}
