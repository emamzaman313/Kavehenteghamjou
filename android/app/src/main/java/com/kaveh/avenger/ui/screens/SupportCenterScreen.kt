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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
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
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
private data class SupportTicketRow(
    val id: String,
    @SerialName("conversation_id") val conversationId: String,
    @SerialName("requester_id") val requesterId: String,
    val subject: String,
    val category: String,
    val status: String,
    val priority: String,
    @SerialName("last_message_at") val lastMessageAt: String? = null,
    @SerialName("created_at") val createdAt: String? = null
)

@Serializable
private data class CreateSupportTicketParams(
    @SerialName("p_subject") val subject: String,
    @SerialName("p_category") val category: String,
    @SerialName("p_body") val body: String
)

private val supportCategories = listOf(
    "general" to "عمومی",
    "account" to "حساب کاربری",
    "technical" to "مشکل فنی",
    "report" to "گزارش تخلف",
    "billing" to "مالی",
    "other" to "سایر"
)

private fun supportStatusLabel(status: String): String = when (status) {
    "open" -> "جدید"
    "in_progress" -> "در حال بررسی"
    "waiting_user" -> "منتظر پاسخ کاربر"
    "resolved" -> "حل‌شده"
    "closed" -> "بسته‌شده"
    else -> status
}

@Composable
fun SupportCenterScreen(
    supabase: SupabaseClient,
    userId: String,
    staff: Boolean
) {
    val scope = rememberCoroutineScope()
    var tickets by remember { mutableStateOf<List<SupportTicketRow>>(emptyList()) }
    var selected by remember { mutableStateOf<SupportTicketRow?>(null) }
    var loading by remember { mutableStateOf(true) }
    var creating by remember { mutableStateOf(false) }
    var showCreate by remember { mutableStateOf(false) }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("general") }
    var categoryExpanded by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun refreshTickets() {
        loading = true
        error = null
        try {
            var query = supabase.postgrest["support_tickets"].select {
                order(column = "last_message_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(100)
            }
            if (!staff) {
                query = supabase.postgrest["support_tickets"].select {
                    filter { eq("requester_id", userId) }
                    order(column = "last_message_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                    limit(100)
                }
            }
            val loaded = query.decodeList<SupportTicketRow>()
            tickets = loaded
            selected = selected?.let { current -> loaded.firstOrNull { it.id == current.id } }
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت درخواست‌های پشتیبانی ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId, staff) { refreshTickets() }

    suspend fun createTicket() {
        val cleanSubject = subject.trim()
        val cleanBody = body.trim()
        if (cleanSubject.length < 3 || cleanBody.isBlank() || creating) return
        creating = true
        error = null
        try {
            val ticketId = supabase.postgrest.rpc(
                "create_support_ticket",
                CreateSupportTicketParams(cleanSubject, category, cleanBody)
            ).decodeAs<String>()
            subject = ""
            body = ""
            category = "general"
            showCreate = false
            refreshTickets()
            selected = tickets.firstOrNull { it.id == ticketId }
                ?: tickets.firstOrNull()
        } catch (exception: Exception) {
            error = exception.message ?: "ثبت درخواست پشتیبانی ناموفق بود."
        } finally {
            creating = false
        }
    }

    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (selected != null) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    IconButton(onClick = { selected = null }) {
                        Icon(Icons.Outlined.ArrowBack, contentDescription = "بازگشت به درخواست‌ها")
                    }
                    Column {
                        Text(selected!!.subject, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        Text("وضعیت: ${supportStatusLabel(selected!!.status)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                IconButton(onClick = { scope.launch { refreshTickets() } }) {
                    Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی")
                }
            }
            ChatScreen(
                supabase = supabase,
                userId = userId,
                conversationIds = setOf(selected!!.conversationId)
            )
        } else {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Icons.Outlined.SupportAgent, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    Column {
                        Text(if (staff) "صندوق پشتیبانی" else "پشتیبانی و ارتباط با مدیریت", fontWeight = FontWeight.Bold)
                        Text(if (staff) "درخواست‌های کاربران و گفتگوهای خصوصی" else "درخواست خود را ثبت کنید و پاسخ را همین‌جا بگیرید", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                IconButton(onClick = { scope.launch { refreshTickets() } }) {
                    Icon(Icons.Outlined.Refresh, contentDescription = "تازه‌سازی")
                }
            }

            if (!staff) {
                OutlinedButton(onClick = { showCreate = !showCreate }, modifier = Modifier.fillMaxWidth()) {
                    Text(if (showCreate) "بستن فرم درخواست" else "ثبت درخواست جدید")
                }
            }

            if (showCreate && !staff) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = subject,
                            onValueChange = { subject = it.take(180) },
                            label = { Text("موضوع درخواست") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )
                        ExposedDropdownMenuBox(
                            expanded = categoryExpanded,
                            onExpandedChange = { categoryExpanded = it }
                        ) {
                            OutlinedTextField(
                                value = supportCategories.first { it.first == category }.second,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("دسته‌بندی") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = categoryExpanded) },
                                modifier = Modifier.menuAnchor().fillMaxWidth()
                            )
                            ExposedDropdownMenu(
                                expanded = categoryExpanded,
                                onDismissRequest = { categoryExpanded = false }
                            ) {
                                supportCategories.forEach { (value, label) ->
                                    DropdownMenuItem(
                                        text = { Text(label) },
                                        onClick = { category = value; categoryExpanded = false }
                                    )
                                }
                            }
                        }
                        OutlinedTextField(
                            value = body,
                            onValueChange = { body = it.take(10000) },
                            label = { Text("شرح درخواست") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 4
                        )
                        Button(
                            onClick = { scope.launch { createTicket() } },
                            enabled = subject.trim().length >= 3 && body.isNotBlank() && !creating,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            if (creating) CircularProgressIndicator()
                            else Text("ارسال درخواست")
                        }
                    }
                }
            }

            error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }

            if (loading) {
                CircularProgressIndicator()
            } else if (tickets.isEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.large
                ) {
                    Text(
                        if (staff) "درخواستی برای نمایش وجود ندارد." else "هنوز درخواستی ثبت نکرده‌اید.",
                        modifier = Modifier.padding(18.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(tickets, key = { it.id }) { ticket ->
                        Card(
                            onClick = { selected = ticket },
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Text(ticket.subject, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${supportStatusLabel(ticket.status)} · ${supportCategories.firstOrNull { it.first == ticket.category }?.second ?: ticket.category}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                                Text(
                                    "اولویت: ${when (ticket.priority) { "urgent" -> "فوری"; "high" -> "بالا"; "low" -> "پایین"; else -> "عادی" }}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.primary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
