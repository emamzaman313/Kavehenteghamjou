package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
    val role: String? = null
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
            Button(onClick = { section = "reports"; scope.launch { loadReports() } }) { Text("گزارش‌ها") }
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
        }
        if (loading) CircularProgressIndicator()
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        notice?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
        if (section == "reports") {
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
                    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
                        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                            Text(name, fontWeight = FontWeight.Bold)
                            Text(email)
                            Text(if (banned) "حساب محدود شده" else "حساب فعال")
                            if (adminRole != null) Text("نقش مدیریتی: $adminRole")
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
