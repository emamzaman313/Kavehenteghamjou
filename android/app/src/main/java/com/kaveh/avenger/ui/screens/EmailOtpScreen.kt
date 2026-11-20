package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.kaveh.avenger.auth.EmailOtpRepository
import com.kaveh.avenger.auth.normalizePasswordDigits
import com.kaveh.avenger.auth.signupPasswordChecks
import com.kaveh.avenger.auth.signupPasswordErrorMessage
import com.kaveh.avenger.ui.progress.OperationProgressController
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
    var passwordLoginMode by remember { mutableStateOf(!passwordSetupRequired) }
    var setupPasswordMode by remember { mutableStateOf(passwordSetupRequired) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf(initialMessage.orEmpty()) }
    var infoMessage by remember { mutableStateOf(if (passwordSetupRequired) "ایمیل شما تأیید شده است؛ برای تکمیل ثبت‌نام رمز عبور بسازید." else "") }
    var resendSeconds by remember { mutableStateOf(0) }
    var showPassword by remember { mutableStateOf(false) }
    var showPasswordConfirm by remember { mutableStateOf(false) }
    val passwordChecks = signupPasswordChecks(password, passwordConfirm)
    val passwordRules = passwordChecks.filter { it.id != "match" }
    val passwordReady = passwordRules.all { it.passed }
    val passwordMatches = passwordChecks.first { it.id == "match" }.passed
    val passedPasswordRules = passwordRules.count { it.passed }
    val passwordStrength = when { password.isEmpty() -> 0; passedPasswordRules <= 1 -> 1; passedPasswordRules <= 3 -> 2; else -> 3 }
    val stageProgress = when { setupPasswordMode -> 1f; codeSent -> .66f; passwordLoginMode -> 0f; else -> .33f }

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
                OperationProgressController.run("ارسال کد ثبت‌نام") { progress ->
                    progress.advance(18, "بررسی آدرس ایمیل")
                    progress.advance(44, "ارسال درخواست به سرویس احراز هویت")
                    authRepository.sendCode(email)
                    progress.advance(90, "درخواست ارسال کد توسط سرور پذیرفته شد")
                }
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
                OperationProgressController.run("ورود به حساب") { progress ->
                    progress.advance(20, "آماده‌سازی اطلاعات ورود")
                    progress.advance(52, "بررسی ایمیل و رمز عبور در سرور")
                    authRepository.loginWithPassword(email, password)
                    progress.advance(90, "نشست معتبر حساب ایجاد شد")
                }
            } catch (error: Exception) {
                val providerMessage = error.message.orEmpty().lowercase()
                errorMessage = if ("weak_password" in providerMessage || ("password" in providerMessage && "weak" in providerMessage)) {
                    "رمز این حساب با شرایط امنیتی فعلی سازگار نیست. با کد ایمیل وارد بخش ساخت رمز شوید و رمز تازه‌ای انتخاب کنید."
                } else {
                    "ایمیل یا رمز عبور صحیح نیست. اگر حساب ندارید، ثبت‌نام با کد ایمیل را انجام دهید."
                }
            } finally {
                isLoading = false
                password = ""
            }
        }
    }

    fun savePassword() {
        val validationError = signupPasswordErrorMessage(password, passwordConfirm)
        if (validationError != null) {
            errorMessage = validationError
            return
        }
        scope.launch {
            isLoading = true
            errorMessage = ""
            infoMessage = ""
            var passwordSaved = false
            try {
                OperationProgressController.run("تکمیل ثبت‌نام و ساخت رمز") { progress ->
                    progress.advance(18, "اعتبارسنجی قدرت و تطابق رمز عبور")
                    progress.advance(48, "ذخیره رمز در سرویس امن احراز هویت")
                    authRepository.setAccountPassword(password)
                    passwordSaved = true
                    progress.advance(90, "رمز ذخیره شد؛ حساب آماده ورود است")
                }
                infoMessage = "ثبت‌نام با موفقیت تکمیل شد. از این پس با ایمیل و رمز عبور وارد شوید."
            } catch (error: Exception) {
                val providerMessage = error.message.orEmpty().lowercase()
                errorMessage = when {
                    "weak_password" in providerMessage || ("password" in providerMessage && "weak" in providerMessage) ->
                        if ("pwned" in providerMessage) "این رمز در نشت‌های اطلاعاتی شناخته‌شده دیده شده است. رمز دیگری انتخاب کنید."
                        else "رمز پذیرفته نشد. حداقل ۱۰ نویسه با حروف کوچک و بزرگ انگلیسی، عدد و نماد انتخاب کنید."
                    else -> error.message ?: "ذخیره رمز عبور انجام نشد. دوباره تلاش کنید."
                }
            } finally {
                isLoading = false
                if (passwordSaved) {
                    password = ""
                    passwordConfirm = ""
                }
            }
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        OutlinedCard(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(28.dp)) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(24.dp).verticalScroll(rememberScrollState()),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(26.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .22f))
                ) {
                    Box(
                        modifier = Modifier.fillMaxWidth().background(
                            Brush.linearGradient(listOf(Color(0xFF102B49), Color(0xFF0A1729), Color(0xFF173B5C)))
                        ).padding(vertical = 22.dp, horizontal = 18.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(modifier = Modifier.background(Color(0xFF163D61), CircleShape).padding(13.dp), contentAlignment = Alignment.Center) {
                                Text("✦", color = Color(0xFF9AD9FF), fontSize = 28.sp, fontWeight = FontWeight.Black)
                            }
                            Text("K A V E H", color = Color(0xFF9AD9FF), style = MaterialTheme.typography.labelMedium)
                            Text("کاوه انتقامجو", color = Color.White, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                            Text("فضای ارتباطی مستقل", color = Color(0xFFB8CDE3), style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                Spacer(Modifier.height(17.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    listOf("ایمیل", "تأیید", "ساخت رمز").forEachIndexed { index, title ->
                        val activeIndex = when { setupPasswordMode -> 2; codeSent -> 1; passwordLoginMode -> -1; else -> 0 }
                        val active = activeIndex == index
                        val done = activeIndex > index
                        Surface(
                            shape = RoundedCornerShape(50),
                            color = when { done -> Color(0xFF174D43); active -> MaterialTheme.colorScheme.primary.copy(alpha = .18f); else -> MaterialTheme.colorScheme.surfaceVariant },
                            border = BorderStroke(1.dp, if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant)
                        ) {
                            Text(
                                (if (done) "✓  " else (index + 1).toString() + "  ") + title,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                                color = when { done -> Color(0xFF8FE0B8); active -> MaterialTheme.colorScheme.primary; else -> MaterialTheme.colorScheme.onSurfaceVariant },
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = if (active) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(
                    progress = { stageProgress },
                    modifier = Modifier.fillMaxWidth().height(4.dp),
                    color = MaterialTheme.colorScheme.primary,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
                Spacer(Modifier.height(18.dp))
                Text(
                    "کاوه انتقامجو", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold
                )
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
                        onValueChange = { password = normalizePasswordDigits(it); errorMessage = "" },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (setupPasswordMode) "انتخاب رمز عبور" else "رمز عبور") },
                        placeholder = { Text(if (setupPasswordMode) "حداقل ۱۰ نویسه؛ حروف کوچک و بزرگ، عدد و نماد" else "رمز حساب شما") },
                        singleLine = true,
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        supportingText = { if (setupPasswordMode) Text("۱۰ نویسه، حرف کوچک و بزرگ انگلیسی، عدد و نماد؛ ارقام فارسی خودکار تبدیل می‌شوند.") },
                        trailingIcon = { androidx.compose.material3.TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "پنهان" else "نمایش") } }
                    )
                    if (setupPasswordMode) {
                        Spacer(Modifier.height(8.dp))
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .58f)),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = .6f))
                        ) {
                            Column(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("قدرت رمز عبور", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                                    Text(listOf("وارد نشده", "نیاز به تقویت", "مناسب", "قوی")[passwordStrength], color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                                }
                                LinearProgressIndicator(
                                    progress = { passwordStrength / 3f },
                                    modifier = Modifier.fillMaxWidth().height(5.dp),
                                    color = when (passwordStrength) { 1 -> Color(0xFFE3A15D); 2 -> Color(0xFF69BDF1); 3 -> Color(0xFF68D3A2); else -> MaterialTheme.colorScheme.outline },
                                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                                )
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    passwordChecks.forEach { check ->
                                        Text(
                                            "${if (check.passed) "✓" else "○"} ${check.label}",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (check.passed) Color(0xFF64C99B) else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = passwordConfirm,
                            onValueChange = { passwordConfirm = normalizePasswordDigits(it); errorMessage = "" },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("تکرار رمز عبور") },
                            placeholder = { Text("دقیقاً همان رمز را دوباره وارد کنید") },
                            singleLine = true,
                            visualTransformation = if (showPasswordConfirm) VisualTransformation.None else PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            trailingIcon = { androidx.compose.material3.TextButton(onClick = { showPasswordConfirm = !showPasswordConfirm }) { Text(if (showPasswordConfirm) "پنهان" else "نمایش") } }
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
                                    OperationProgressController.run("تأیید ایمیل") { progress ->
                                        progress.advance(18, "بررسی قالب شش‌رقمی کد")
                                        if (code.length != 6) throw IllegalArgumentException("کد باید دقیقاً ۶ رقم باشد.")
                                        progress.advance(48, "اعتبارسنجی کد یک‌بارمصرف در سرور")
                                        authRepository.verifyCode(email, code)
                                        progress.advance(88, "کد تأیید شد؛ نشست امن ایجاد شد")
                                    }
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
                        setupPasswordMode -> passwordReady && passwordMatches
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
                Spacer(Modifier.height(10.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = .42f)),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = .55f))
                ) {
                    Column(modifier = Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("چرا ثبت‌نام کاوه امن‌تر است؟", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                        listOf("✓  ایمیل فقط یک‌بار برای تأیید مالکیت بررسی می‌شود", "✓  بعد از ساخت رمز، ورودهای بعدی با رمز انجام می‌شود", "✓  رمز در سرویس احراز هویت ذخیره می‌شود، نه متن ساده").forEach {
                            Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
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
