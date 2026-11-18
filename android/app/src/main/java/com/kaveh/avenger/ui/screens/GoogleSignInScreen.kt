package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kaveh.avenger.auth.GoogleAuthRepository
import com.kaveh.avenger.auth.GoogleAuthErrorMessage
import com.kaveh.avenger.data.SupabaseClientProvider
import kotlinx.coroutines.launch

@Composable
fun GoogleSignInScreen(
    authRepository: GoogleAuthRepository,
    initialMessage: String? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf(initialMessage) }
    val configured = remember {
        SupabaseClientProvider.isConfigured &&
            com.kaveh.avenger.BuildConfig.GOOGLE_WEB_CLIENT_ID.endsWith(".apps.googleusercontent.com")
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        MaterialTheme.colorScheme.background,
                        MaterialTheme.colorScheme.surface,
                        MaterialTheme.colorScheme.background
                    )
                )
            )
            .padding(horizontal = 24.dp, vertical = 30.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Spacer(Modifier.height(16.dp))
            Text(
                text = "کاوه انتقامجو",
                style = MaterialTheme.typography.headlineLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = "ارتباطات، گفتگو و اشتراک‌گذاری؛ در یک فضای اختصاصی",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(36.dp))

            OutlinedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(28.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        "ورود امن با حساب گوگل",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "برای استفاده از برنامه، ورود یا ثبت‌نام الزامی است.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                    Spacer(Modifier.height(22.dp))
                    Button(
                        onClick = {
                            scope.launch {
                                isLoading = true
                                errorMessage = null
                                try {
                                    authRepository.signIn(context)
                                } catch (error: Exception) {
                                    errorMessage = GoogleAuthErrorMessage.from(error)
                                } finally {
                                    isLoading = false
                                }
                            }
                        },
                        enabled = configured && !isLoading,
                        modifier = Modifier.fillMaxWidth().height(54.dp),
                        shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF8F8F8),
                            contentColor = Color(0xFF202124),
                            disabledContainerColor = Color(0xFF77736B)
                        )
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = Color(0xFF202124)
                            )
                            Text("  در حال اتصال...")
                        } else {
                            Text("G", color = Color(0xFF4285F4), fontWeight = FontWeight.Black, fontSize = 20.sp)
                            Text("  ادامه با Google", fontWeight = FontWeight.SemiBold)
                        }
                    }
                    if (!configured) {
                        Spacer(Modifier.height(12.dp))
                        Text(
                            "تنظیمات Supabase و Google Web Client ID در local.properties کامل نشده است.",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center
                        )
                    }
                    if (!errorMessage.isNullOrBlank()) {
                        Spacer(Modifier.height(14.dp))
                        Text(
                            errorMessage.orEmpty(),
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            Text(
                "با ادامه، شرایط استفاده و سیاست حریم خصوصی برنامه اعمال می‌شود.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun LoadingScreen() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(16.dp))
            Text("در حال آماده‌سازی فضای شما…", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
