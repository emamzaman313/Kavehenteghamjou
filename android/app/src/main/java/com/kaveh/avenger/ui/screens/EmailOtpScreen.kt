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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.kaveh.avenger.auth.EmailOtpRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

internal fun normalizeEmailOtpInput(value: String): String =
    value.mapNotNull { it.digitToIntOrNull() }.take(6).joinToString("")

@Composable
fun EmailOtpScreen(
    authRepository: EmailOtpRepository,
    initialMessage: String? = null,
    initialEmail: String = "",
    passwordSetupRequired: Boolean = false
) {
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf(initialEmail) }
    var code by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordConfirm by remember { mutableStateOf("") }
    var codeSent by remember { mutableStateOf(false) }
    var passwordLoginMode by remember { mutableStateOf(false) }
    var setupPasswordMode by remember { mutableStateOf(passwordSetupRequired) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf(initialMessage.orEmpty()) }
    var infoMessage by remember { mutableStateOf(if (passwordSetupRequired) "ایمیل شما تأیید شده است؛ برای تکمیل ثبت‌نام رمز عبور بسازید." else "") }
    var resendSeconds by remember { mutableStateOf(0) }

    LaunchedEffect(resendSeconds) {
        if (resendSeconds > 0) {
            delay(1_000)
            resendSeconds -= 1
        }
    }

    fun sendCode() {
        if (isLoading || resendSeconds > 0) return
        scope.launch {
            isLoading = true
            errorMessage = ""
            infoMessage = ""
            try {
                authRepository.sendCode(email)
                codeSent = true
                code = ""
                passwordLoginMode = false
                resendSeconds = 30
                infoMessage = "کد تأیید به ایمیل شما ارسال شد. فقط کد آخرین ایمیل را وارد کنید."
            } catch (error: Exception) {
                val providerMessage = error.message.orEmpty().lowercase()
                if ("rate" in providerMessage || "too many" in providerMessage || "429" in providerMessage) resendSeconds = 30
                errorMessage = error.message ?: "ارسال کد انجام نشد. دوباره تلاش کنید."
            } finally {
                isLoading = false
            }
        }
    }

    fun loginWithPassword() {
        scope.launch {
            isLoading = true
            errorMessage = ""
            infoMessage = ""
            try {
                authRepository.loginWithPassword(email, password)
            } catch (error: Exception) {
                errorMessage = "ایمیل یا رمز عبور صحیح نیست. اگر حساب ندارید، ثبت‌نام با کد ایمیل را انجام دهید."
            } finally {
                isLoading = false
                password = ""
            }
        }
    }

    fun savePassword() {
        if (password.length < 10 || !password.any { it in 'a'..'z' } || !password.any { it in 'A'..'Z' } || !password.any { it.isDigit() } || !password.any { !it.isLetterOrDigit() }) {
            errorMessage = "رمز عبور باید حداقل ۱۰ نویسه و شامل حروف کوچک و بزرگ انگلیسی، عدد و نماد باشد."
            return
        }
        if (password != passwordConfirm) {
            errorMessage = "تکرار رمز عبور دقیقاً با رمز اول یکسان نیست."
            return
        }
        scope.launch {
            isLoading = true
            errorMessage = ""
            infoMessage = ""
            try {
                authRepository.setAccountPassword(password)
                infoMessage = "ثبت‌نام با موفقیت تکمیل شد. از این پس با ایمیل و رمز عبور وارد شوید."
            } catch (error: Exception) {
                val providerMessage = error.message.orEmpty().lowercase()
                errorMessage = when {
                    "weak_password" in providerMessage || ("password" in providerMessage && "weak" in providerMessage) ->
                        if ("pwned" in providerMessage) "این رمز در نشت‌های اطلاعاتی شناخته‌شده دیده شده است. رمز دیگری انتخاب کنید."
                        else "رمز عبور پذیرفته نشد. حداقل ۱۰ نویسه و ترکیب حروف کوچک و بزرگ انگلیسی، عدد و نماد را رعایت کنید."
                    else -> error.message ?: "ذخیره رمز عبور انجام نشد. دوباره تلاش کنید."
                }
            } finally {
                isLoading = false
                password = ""
                passwordConfirm = ""
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
                    when {
                        setupPasswordMode -> "ایمیل تأیید شده است. برای تکمیل حساب، رمز عبور انتخاب کنید."
                        passwordLoginMode -> "با ایمیل و رمز عبور حساب خود وارد شوید."
                        else -> "برای ثبت‌نام، ایمیل خود را وارد کنید تا کد تأیید برایتان ارسال شود."
                    },
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
                    enabled = !isLoading && !codeSent && !setupPasswordMode,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                )

                if (setupPasswordMode || passwordLoginMode) {
                    Spacer(Modifier.height(14.dp))
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it; errorMessage = "" },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (setupPasswordMode) "انتخاب رمز عبور" else "رمز عبور") },
                        placeholder = { Text(if (setupPasswordMode) "۱۰ نویسه، حروف بزرگ و کوچک، عدد و نماد" else "رمز حساب شما") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                    )
                    if (setupPasswordMode) {
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = passwordConfirm,
                            onValueChange = { passwordConfirm = it; errorMessage = "" },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("تکرار رمز عبور") },
                            placeholder = { Text("دقیقاً همان رمز را دوباره وارد کنید") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password)
                        )
                    }
                } else if (codeSent) {
                    Spacer(Modifier.height(14.dp))
                    Text("کد ارسال‌شده به $email را وارد کنید.", style = MaterialTheme.typography.bodySmall, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        value = code,
                        onValueChange = { code = normalizeEmailOtpInput(it); errorMessage = "" },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("کد تأیید ایمیل") },
                        placeholder = { Text("تمام ارقام کد دریافتی") },
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
                        when {
                            setupPasswordMode -> savePassword()
                            passwordLoginMode -> loginWithPassword()
                            !codeSent -> sendCode()
                            else -> scope.launch {
                                isLoading = true
                                errorMessage = ""
                                try {
                                    if (code.length != 6) throw IllegalArgumentException("کد باید دقیقاً ۶ رقم باشد.")
                                    authRepository.verifyCode(email, code)
                                    setupPasswordMode = true
                                    infoMessage = "ایمیل تأیید شد. اکنون رمز عبور خود را انتخاب کنید."
                                } catch (error: Exception) {
                                    errorMessage = error.message ?: "کد واردشده معتبر نیست یا منقضی شده است."
                                } finally {
                                    isLoading = false
                                }
                            }
                        }
                    },
                    enabled = !isLoading && when {
                        setupPasswordMode -> password.length >= 10 && password == passwordConfirm
                        passwordLoginMode -> email.contains("@") && password.isNotBlank()
                        codeSent -> code.length == 6
                        else -> email.contains("@") && email.substringAfter("@").contains(".")
                    },
                    modifier = Modifier.fillMaxWidth().height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    if (isLoading) CircularProgressIndicator()
                    else Text(
                        when {
                            setupPasswordMode -> "تکمیل ثبت‌نام و ساخت حساب"
                            passwordLoginMode -> "ورود با رمز عبور"
                            codeSent -> "تأیید ایمیل و ادامه ثبت‌نام"
                            else -> "ارسال کد ثبت‌نام به ایمیل"
                        },
                        fontWeight = FontWeight.SemiBold
                    )
                }

                if (!passwordSetupRequired && !setupPasswordMode) {
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = {
                            passwordLoginMode = !passwordLoginMode
                            codeSent = false
                            code = ""
                            resendSeconds = 0
                            password = ""
                            errorMessage = ""
                            infoMessage = ""
                        },
                        enabled = !isLoading,
                        colors = ButtonDefaults.textButtonColors()
                    ) {
                        Text(if (passwordLoginMode) "ثبت‌نام با کد ایمیل" else "قبلاً حساب ساخته‌اید؟ ورود با رمز")
                    }
                }

                if (codeSent && !setupPasswordMode) {
                    Spacer(Modifier.height(8.dp))
                    Button(
                        onClick = { codeSent = false; code = ""; resendSeconds = 0; errorMessage = ""; infoMessage = "" },
                        enabled = !isLoading,
                        colors = ButtonDefaults.textButtonColors()
                    ) { Text("تغییر ایمیل") }
                    Button(onClick = { sendCode() }, enabled = !isLoading && resendSeconds == 0) {
                        Text(if (resendSeconds > 0) "ارسال دوباره کد پس از $resendSeconds ثانیه" else "ارسال دوباره کد")
                    }
                }
                Spacer(Modifier.height(18.dp))
                Text(
                    "رمز عبور در سرویس امن احراز هویت به‌صورت هش‌شده نگهداری می‌شود.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}
