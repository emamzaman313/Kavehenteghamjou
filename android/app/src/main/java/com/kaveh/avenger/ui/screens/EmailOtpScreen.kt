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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.kaveh.avenger.auth.EmailOtpRepository
import kotlinx.coroutines.launch

@Composable
fun EmailOtpScreen(
    authRepository: EmailOtpRepository,
    initialMessage: String? = null
) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var codeSent by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf(initialMessage.orEmpty()) }
    var infoMessage by remember { mutableStateOf("") }

    fun sendCode() {
        scope.launch {
            isLoading = true
            errorMessage = ""
            infoMessage = ""
            try {
                authRepository.sendCode(email)
                codeSent = true
                infoMessage = "کد ۶ رقمی به ایمیل شما ارسال شد. صندوق ورودی و هرزنامه را بررسی کنید."
            } catch (error: Exception) {
                errorMessage = error.message ?: "ارسال کد انجام نشد. دوباره تلاش کنید."
            } finally {
                isLoading = false
            }
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        OutlinedCard(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text("کاوه انتقامجو", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Text(
                    "برای ورود، ایمیل خود را وارد کنید تا کد تأیید یک‌بارمصرف برایتان ارسال شود.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(24.dp))
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; errorMessage = "" },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("آدرس ایمیل") },
                    placeholder = { Text("name@example.com") },
                    singleLine = true,
                    enabled = !isLoading && !codeSent,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )
                if (codeSent) {
                    Spacer(Modifier.height(14.dp))
                    Text("کد ارسال‌شده به $email را وارد کنید.", style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = code,
                        onValueChange = { code = it.filter(Char::isDigit).take(6); errorMessage = "" },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("کد تأیید ۶ رقمی") },
                        placeholder = { Text("123456") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                }
                if (infoMessage.isNotBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Text(infoMessage, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                }
                if (errorMessage.isNotBlank()) {
                    Spacer(Modifier.height(12.dp))
                    Text(errorMessage, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                }
                Spacer(Modifier.height(20.dp))
                Button(
                    onClick = {
                        if (!codeSent) sendCode()
                        else scope.launch {
                            isLoading = true
                            errorMessage = ""
                            try {
                                authRepository.verifyCode(email, code)
                            } catch (error: Exception) {
                                errorMessage = error.message ?: "کد واردشده معتبر نیست یا منقضی شده است."
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    enabled = !isLoading && if (codeSent) code.length == 6 else email.contains("@") && email.substringAfter("@").contains("."),
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    if (isLoading) CircularProgressIndicator()
                    else Text(if (codeSent) "تأیید کد و ورود" else "ارسال کد ورود به ایمیل", fontWeight = FontWeight.SemiBold)
                }
                if (codeSent) {
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { codeSent = false; code = ""; errorMessage = ""; infoMessage = "" },
                        enabled = !isLoading,
                        colors = ButtonDefaults.textButtonColors()
                    ) { Text("تغییر ایمیل") }
                    Button(onClick = { sendCode() }, enabled = !isLoading) { Text("ارسال دوباره کد") }
                }
                Spacer(Modifier.height(18.dp))
                Text("ورود امن با کد یک‌بارمصرف ایمیل؛ بدون نیاز به حساب گوگل", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
            }
        }
    }
}
