package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.functions.functions
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

@Serializable
private data class AdminActionRequest(
    val action: String,
    val reportId: String? = null,
    val status: String? = null,
    val userId: String? = null,
    val reason: String? = null,
    val duration: String? = null,
    val role: String? = null,
    val restriction: String? = null,
    val muteId: String? = null,
    val key: String? = null,
    val enabled: Boolean? = null
)

private suspend fun callAdminConsole(supabase: SupabaseClient, request: AdminActionRequest): JsonObject {
    val response = supabase.functions("admin-console", body = request)
    val raw = response.bodyAsText()
    val payload = runCatching { Json.parseToJsonElement(raw).jsonObject }.getOrElse {
        throw IllegalStateException("پاسخ پنل مدیریت قابل خواندن نیست.")
    }
    if (response.status.value !in 200..299 || payload["ok"]?.jsonPrimitive?.booleanOrNull != true) {
        val reason = payload["reason"]?.jsonPrimitive?.contentOrNull
        throw IllegalStateException(when (reason) {
            "insufficient_role" -> "نقش حساب شما اجازه این عملیات را نمی‌دهد."
            "not_admin" -> "دسترسی مدیریتی برای این حساب فعال نیست."
            "invalid_reason" -> "دلیل باید بین ۳ تا ۵۰۰ نویسه باشد."
            "invalid_mute_restriction" -> "نوع محدودیت انتخاب‌شده معتبر نیست."
            "invalid_mute_duration" -> "مدت میوت انتخاب‌شده معتبر نیست."
            "mute_create_failed" -> "ثبت محدودیت ناموفق بود."
            "mute_not_found" -> "محدودیت موردنظر پیدا نشد."
            "mute_already_revoked" -> "این محدودیت قبلاً لغو شده است."
            "mute_revoke_failed" -> "لغو محدودیت ناموفق بود."
            else -> "عملیات مدیریتی انجام نشد: ${reason ?: response.status.value}"
        })
    }
    return payload
}

@Composable
fun AdminConsoleScreen(supabase: SupabaseClient, role: String) {
    val scope = rememberCoroutineScope()
    var section by remember { mutableStateOf("reports") }
    var reports by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var users by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var reason by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var busyId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var muteRestriction by remember { mutableStateOf("message_send") }
    var muteDuration by remember { mutableStateOf("24h") }
    var showRestrictionMenu by remember { mutableStateOf(false) }
    var showDurationMenu by remember { mutableStateOf(false) }
    var featureFlags by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var overviewStats by remember { mutableStateOf<JsonObject?>(null) }

    val muteRestrictions = listOf(
        "message_send" to "ارسال همه پیام‌ها",
        "group_message_send" to "پیام در گروه‌ها",
        "comment" to "ثبت دیدگاه",
        "post_publish" to "انتشار پست",
        "reel_publish" to "انتشار ریلز",
        "file_upload" to "بارگذاری فایل"
    )
    val muteDurations = listOf(
        "1h" to "۱ ساعت",
        "24h" to "۲۴ ساعت",
        "168h" to "۷ روز",
        "720h" to "۳۰ روز",
        "permanent" to "دائمی"
    )

    suspend fun loadOverview() {
        loading = true; error = null
        try {
            val result = callAdminConsole(supabase, AdminActionRequest(action = "overview"))
            overviewStats = result["stats"]?.jsonObject
        } catch (exception: Exception) { error = exception.message ?: "دریافت آمار ناموفق بود." }
        finally { loading = false }
    }

    suspend fun loadFeatureFlags() {
        loading = true; error = null
        try {
            val result = callAdminConsole(supabase, AdminActionRequest(action = "feature_flags_list"))
            featureFlags = result["flags"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
        } catch (exception: Exception) { error = exception.message ?: "دریافت امکانات ناموفق بود." }
        finally { loading = false }
    }

    suspend fun updateFeatureFlag(key: String, enabled: Boolean) {
        busyId = key; error = null
        try {
            callAdminConsole(supabase, AdminActionRequest(action = "feature_flag_set", key = key, enabled = enabled))
            notice = if (enabled) "امکان فعال شد." else "امکان غیرفعال شد."
            loadFeatureFlags()
        } catch (exception: Exception) { error = exception.message ?: "تغییر امکان ناموفق بود." }
        finally { busyId = null }
    }

    suspend fun loadReports() {
        loading = true
        error = null
        try {
            val result = callAdminConsole(supabase, AdminActionRequest(action = "reports_list"))
            reports = result["reports"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت گزارش‌ها ناموفق بود."
        } finally { loading = false }
    }

    suspend fun loadUsers() {
        loading = true
        error = null
        try {
            val result = callAdminConsole(supabase, AdminActionRequest(action = "users_list"))
            users = result["users"]?.jsonArray?.map { it.jsonObject } ?: emptyList()
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت کاربران ناموفق بود."
        } finally { loading = false }
    }

    LaunchedEffect(role) {
        if (role in listOf("owner", "admin", "moderator")) loadReports()
        else { loading = false; error = "نقش فعلی فقط به بخش‌های محدود مدیریتی دسترسی دارد." }
    }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("پنل مدیریت", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text("نقش فعال: $role", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = { section = "overview"; scope.launch { loadOverview() } }) { Text("مرکز فرماندهی") }
            Button(onClick = { section = "reports"; scope.launch { loadReports() } }) { Text("گزارش‌ها") }
            if (role in listOf("owner", "admin")) Button(onClick = { section = "features"; scope.launch { loadFeatureFlags() } }) { Text("کنترل امکانات") }
            if (role in listOf("owner", "admin")) {
                Button(onClick = { section = "users"; scope.launch { loadUsers() } }) { Text("کاربران") }
            }
        }
        if (section == "users" && role in listOf("owner", "admin")) {
            OutlinedTextField(
                value = reason,
                onValueChange = { reason = it.take(500) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("دلیل اخطار یا محدودیت (حداقل ۳ نویسه)") },
                minLines = 2
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Box {
                    OutlinedButton(onClick = { showRestrictionMenu = true }) {
                        Text(muteRestrictions.first { it.first == muteRestriction }.second)
                    }
                    DropdownMenu(expanded = showRestrictionMenu, onDismissRequest = { showRestrictionMenu = false }) {
                        muteRestrictions.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { muteRestriction = value; showRestrictionMenu = false }
                            )
                        }
                    }
                }
                Box {
                    OutlinedButton(onClick = { showDurationMenu = true }) {
                        Text(muteDurations.first { it.first == muteDuration }.second)
                    }
                    DropdownMenu(expanded = showDurationMenu, onDismissRequest = { showDurationMenu = false }) {
                        muteDurations.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = { muteDuration = value; showDurationMenu = false }
                            )
                        }
                    }
                }
            }
        }
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        notice?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
        if (section == "overview" && role in listOf("owner", "admin")) {
            val stats = overviewStats
            val labels = listOf("users" to "کاربران", "posts" to "پست‌ها", "comments" to "دیدگاه‌ها", "pending_reports" to "گزارش‌های باز", "new_users_7d" to "عضو جدید در ۷ روز")
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("نمای کلی زنده", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    Button(onClick={scope.launch{loadOverview()}}){Text("تازه‌سازی")}
                    Text("آمار بر اساس داده‌های سرور",style=MaterialTheme.typography.labelSmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                }
                labels.forEach { (key,label) ->
                    Card(modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp)) {
                        Row(Modifier.fillMaxWidth().padding(13.dp),horizontalArrangement=Arrangement.SpaceBetween) {
                            Text(label)
                            Text(stats?.get(key)?.jsonPrimitive?.contentOrNull ?: "—",fontWeight=FontWeight.Bold,color=MaterialTheme.colorScheme.primary)
                        }
                    }
                }
            }
        } else if (section == "features" && role in listOf("owner", "admin")) {
            Text("کنترل مرکزی امکانات",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
            featureFlags.forEach { flag ->
                val key=flag["key"]?.jsonPrimitive?.contentOrNull.orEmpty()
                val title=flag["title"]?.jsonPrimitive?.contentOrNull ?: key
                val description=flag["description"]?.jsonPrimitive?.contentOrNull.orEmpty()
                val enabled=flag["enabled"]?.jsonPrimitive?.booleanOrNull == true
                Card(modifier=Modifier.fillMaxWidth(),shape=RoundedCornerShape(14.dp)) {
                    Row(Modifier.fillMaxWidth().padding(13.dp),horizontalArrangement=Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f),verticalArrangement=Arrangement.spacedBy(4.dp)) {
                            Text(title,fontWeight=FontWeight.SemiBold)
                            Text(description,style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(if(enabled)"فعال" else "غیرفعال",style=MaterialTheme.typography.labelSmall,color=if(enabled)MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                        }
                        androidx.compose.material3.Switch(checked=enabled,enabled=busyId==null,onCheckedChange={value->scope.launch{updateFeatureFlag(key,value)}})
                    }
                }
            }
        } else if (section == "reports") {
            if (!loading && reports.isEmpty() && error == null) Text("گزارشی برای نمایش وجود ندارد.")
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(reports, key = { it["id"]?.jsonPrimitive?.contentOrNull ?: it.hashCode().toString() }) { report ->
                    val id = report["id"]?.jsonPrimitive?.contentOrNull.orEmpty()
                    val summary = report["target_summary"]?.jsonPrimitive?.contentOrNull ?: "محتوای گزارش‌شده"
                    val type = report["target_type"]?.jsonPrimitive?.contentOrNull ?: "نامشخص"
                    val status = report["status"]?.jsonPrimitive?.contentOrNull ?: "open"
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text("$type • $status", fontWeight = FontWeight.Bold)
                            Text(summary)
                            Text("دلیل: ${report["reason"]?.jsonPrimitive?.contentOrNull ?: "—"}")
                            val details = report["details"]?.jsonPrimitive?.contentOrNull
                            if (!details.isNullOrBlank()) Text(details)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(enabled = busyId != id && status != "reviewing", onClick = {
                                    scope.launch {
                                        busyId = id; error = null
                                        try {
                                            callAdminConsole(supabase, AdminActionRequest("review_report", reportId = id, status = "reviewing"))
                                            notice = "گزارش به وضعیت در حال بررسی تغییر کرد."; loadReports()
                                        } catch (exception: Exception) { error = exception.message }
                                        finally { busyId = null }
                                    }
                                }) { Text("بررسی") }
                                Button(enabled = busyId != id && status != "resolved", onClick = {
                                    scope.launch {
                                        busyId = id; error = null
                                        try {
                                            callAdminConsole(supabase, AdminActionRequest("review_report", reportId = id, status = "resolved"))
                                            notice = "گزارش تأیید و بسته شد."; loadReports()
                                        } catch (exception: Exception) { error = exception.message }
                                        finally { busyId = null }
                                    }
                                }) { Text("تأیید") }
                                Button(enabled = busyId != id && status != "rejected", onClick = {
                                    scope.launch {
                                        busyId = id; error = null
                                        try {
                                            callAdminConsole(supabase, AdminActionRequest("review_report", reportId = id, status = "rejected"))
                                            notice = "گزارش رد شد."; loadReports()
                                        } catch (exception: Exception) { error = exception.message }
                                        finally { busyId = null }
                                    }
                                }) { Text("رد") }
                            }
                        }
                    }
                }
            }
        } else if (section == "users" && role in listOf("owner", "admin")) {
            if (!loading && users.isEmpty() && error == null) Text("کاربری برای نمایش وجود ندارد.")
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(users, key = { it["id"]?.jsonPrimitive?.contentOrNull ?: it.hashCode().toString() }) { user ->
                    val id = user["id"]?.jsonPrimitive?.contentOrNull.orEmpty()
                    val banned = user["is_banned"]?.jsonPrimitive?.booleanOrNull == true
                    val name = user["display_name"]?.jsonPrimitive?.contentOrNull ?: "کاربر"
                    val email = user["email"]?.jsonPrimitive?.contentOrNull ?: "بدون ایمیل"
                    val adminRole = user["admin_role"]?.jsonPrimitive?.contentOrNull
                    val warningCount = user["warning_count"]?.jsonPrimitive?.contentOrNull ?: "0"
                    val activeMutes = user["active_mutes"]?.jsonArray?.mapNotNull { runCatching { it.jsonObject }.getOrNull() } ?: emptyList()
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(name, fontWeight = FontWeight.Bold)
                            Text(email)
                            Text(if (banned) "حساب محدود شده" else "حساب فعال")
                            Text("تعداد اخطارهای ثبت‌شده: $warningCount")
                            if (adminRole != null) Text("نقش مدیریتی: $adminRole")
                            activeMutes.forEach { mute ->
                                val muteId = mute["id"]?.jsonPrimitive?.contentOrNull.orEmpty()
                                val restriction = mute["restriction"]?.jsonPrimitive?.contentOrNull.orEmpty()
                                val restrictionLabel = muteRestrictions.firstOrNull { it.first == restriction }?.second ?: restriction
                                val expiresAt = mute["expires_at"]?.jsonPrimitive?.contentOrNull
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text(
                                        "میوت فعال: $restrictionLabel · " + (expiresAt?.take(16) ?: "دائمی"),
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    TextButton(
                                        enabled = busyId != id && muteId.isNotBlank(),
                                        onClick = {
                                            scope.launch {
                                                busyId = id; error = null
                                                try {
                                                    callAdminConsole(
                                                        supabase,
                                                        AdminActionRequest(
                                                            "unmute_user",
                                                            userId = id,
                                                            reason = reason.trim().ifEmpty { "لغو محدودیت توسط مدیر" },
                                                            muteId = muteId
                                                        )
                                                    )
                                                    notice = "محدودیت انتخاب‌شده برای $name لغو شد."
                                                    loadUsers()
                                                } catch (exception: Exception) { error = exception.message }
                                                finally { busyId = null }
                                            }
                                        }
                                    ) { Text("رفع میوت") }
                                }
                            }
                            if (role == "owner" && id.isNotBlank() && adminRole != "owner") {
                                Text("مدیریت نقش دسترسی", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                    listOf("admin" to "مدیر", "moderator" to "ناظر", "support" to "پشتیبانی").forEach { (newRole, label) ->
                                        Button(enabled = busyId != id && adminRole != newRole, onClick = {
                                            scope.launch {
                                                busyId = id; error = null
                                                try {
                                                    callAdminConsole(supabase, AdminActionRequest("set_admin_role", userId = id, role = newRole))
                                                    notice = "نقش $name به $label تغییر کرد."; loadUsers()
                                                } catch (exception: Exception) { error = exception.message }
                                                finally { busyId = null }
                                            }
                                        }) { Text(label) }
                                    }
                                    if (adminRole != null) {
                                        Button(enabled = busyId != id, onClick = {
                                            scope.launch {
                                                busyId = id; error = null
                                                try {
                                                    callAdminConsole(supabase, AdminActionRequest("remove_admin_role", userId = id))
                                                    notice = "دسترسی مدیریتی $name برداشته شد."; loadUsers()
                                                } catch (exception: Exception) { error = exception.message }
                                                finally { busyId = null }
                                            }
                                        }) { Text("حذف نقش") }
                                    }
                                }
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Button(enabled = busyId != id && reason.trim().length >= 3 && adminRole == null, onClick = {
                                    scope.launch {
                                        busyId = id; error = null
                                        try {
                                            callAdminConsole(supabase, AdminActionRequest("warn_user", userId = id, reason = reason.trim()))
                                            notice = "اخطار برای $name ثبت شد."; loadUsers()
                                        } catch (exception: Exception) { error = exception.message }
                                        finally { busyId = null }
                                    }
                                }) { Text("اخطار") }
                                Button(enabled = busyId != id && reason.trim().length >= 3 && !banned && adminRole == null, onClick = {
                                    scope.launch {
                                        busyId = id; error = null
                                        try {
                                            callAdminConsole(supabase, AdminActionRequest("ban_user", userId = id, reason = reason.trim(), duration = "24h"))
                                            notice = "حساب $name برای ۲۴ ساعت محدود شد."; loadUsers()
                                        } catch (exception: Exception) { error = exception.message }
                                        finally { busyId = null }
                                    }
                                }) { Text("محدودسازی ۲۴ساعته") }
                                Button(enabled = busyId != id && reason.trim().length >= 3 && adminRole == null, onClick = {
                                    scope.launch {
                                        busyId = id; error = null
                                        try {
                                            callAdminConsole(
                                                supabase,
                                                AdminActionRequest(
                                                    "mute_user",
                                                    userId = id,
                                                    reason = reason.trim(),
                                                    duration = muteDuration,
                                                    restriction = muteRestriction
                                                )
                                            )
                                            val label = muteRestrictions.first { it.first == muteRestriction }.second
                                            notice = "محدودیت «$label» برای $name ثبت شد."
                                            loadUsers()
                                        } catch (exception: Exception) { error = exception.message }
                                        finally { busyId = null }
                                    }
                                }) { Text("اعمال میوت") }
                                if (banned) Button(enabled = busyId != id && adminRole == null, onClick = {
                                    scope.launch {
                                        busyId = id; error = null
                                        try {
                                            callAdminConsole(supabase, AdminActionRequest("unban_user", userId = id, reason = "رفع محدودیت توسط پنل اندروید"))
                                            notice = "محدودیت حساب $name برداشته شد."; loadUsers()
                                        } catch (exception: Exception) { error = exception.message }
                                        finally { busyId = null }
                                    }
                                }) { Text("رفع محدودیت") }
                            }
                        }
                    }
                }
            }
        }
    }
}
