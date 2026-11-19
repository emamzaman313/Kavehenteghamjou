package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.material3.FilterChip
import androidx.compose.material3.DropdownMenu
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
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.channel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.JsonPrimitive

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
    @SerialName("created_at") val createdAt: String? = null,
    val requesterLabel: String? = null
)

@Serializable
private data class SupportProfileRow(
    val id: String,
    @SerialName("display_name") val displayName: String? = null,
    val username: String? = null
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SupportCenterScreen(
    supabase: SupabaseClient,
    userId: String,
    staff: Boolean
) {
    val scope = rememberCoroutineScope()
    var tickets by remember { mutableStateOf<List<SupportTicketRow>>(emptyList()) }
    var ticketSearch by remember { mutableStateOf("") }
    var ticketStatusFilter by remember { mutableStateOf("all") }
    var ticketPriorityFilter by remember { mutableStateOf("all") }
    var selected by remember { mutableStateOf<SupportTicketRow?>(null) }
    var loading by remember { mutableStateOf(true) }
    var creating by remember { mutableStateOf(false) }
    var showCreate by remember { mutableStateOf(false) }
    var subject by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("general") }
    var categoryExpanded by remember { mutableStateOf(false) }
    var statusExpanded by remember { mutableStateOf(false) }
    var priorityExpanded by remember { mutableStateOf(false) }
    var updatingTicket by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    val filteredTickets = tickets.filter { ticket ->
        val matchesStatus = ticketStatusFilter == "all" || ticket.status == ticketStatusFilter
        val matchesPriority = !staff || ticketPriorityFilter == "all" || ticket.priority == ticketPriorityFilter
        val searchable = listOf(ticket.subject, ticket.requesterLabel.orEmpty(), ticket.category, ticket.id).joinToString(" ")
        matchesStatus && matchesPriority &&
            (ticketSearch.isBlank() || searchable.contains(ticketSearch.trim(), ignoreCase = true))
    }

    suspend fun refreshTickets() {
        loading = true
        error = null
        try {
            val loaded = if (staff) {
                supabase.postgrest["support_tickets"].select {
                    order(column = "last_message_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                    limit(100)
                }.decodeList<SupportTicketRow>()
            } else {
                supabase.postgrest["support_tickets"].select {
                    filter { eq("requester_id", userId) }
                    order(column = "last_message_at", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                    limit(100)
                }.decodeList<SupportTicketRow>()
            }
            val enriched = if (staff && loaded.isNotEmpty()) {
                runCatching {
                    val profiles = supabase.postgrest["profiles"].select {
                        limit(500)
                    }.decodeList<SupportProfileRow>().associateBy { it.id }
                    loaded.map { ticket ->
                        val profile = profiles[ticket.requesterId]
                        val label = profile?.displayName?.takeIf { it.isNotBlank() }
                            ?: profile?.username?.let { "@$it" }
                            ?: ticket.requesterId.take(8)
                        ticket.copy(requesterLabel = label)
                    }
                }.getOrDefault(loaded)
            } else loaded
            tickets = enriched
            selected = selected?.let { current -> enriched.firstOrNull { it.id == current.id } }
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت درخواست‌های پشتیبانی ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId, staff) {
        refreshTickets()
        val ticketChannel = supabase.channel("android-support-tickets-$userId")
        val ticketChanges = ticketChannel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "support_tickets"
        }
        val ticketCollector = launch {
            ticketChanges.collect {
                refreshTickets()
            }
        }
        try {
            ticketChannel.subscribe(blockUntilSubscribed = true)
            // Fetch once more after subscribing to close the initial-load race.
            refreshTickets()
            awaitCancellation()
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (exception: Exception) {
            error = exception.message ?: "اتصال زنده صندوق پشتیبانی برقرار نشد."
        } finally {
            ticketCollector.cancel()
            supabase.realtime.removeChannel(ticketChannel)
        }
    }

    suspend fun updateTicketField(ticket: SupportTicketRow, field: String, value: String) {
        if (!staff || updatingTicket) return
        updatingTicket = true
        error = null
        try {
            supabase.postgrest["support_tickets"].update({
                set(field, value)
            }) {
                filter { eq("id", ticket.id) }
            }
            refreshTickets()
        } catch (exception: Exception) {
            error = exception.message ?: "به‌روزرسانی درخواست ناموفق بود."
        } finally {
            updatingTicket = false
        }
    }

    suspend fun createTicket() {
        val cleanSubject = subject.trim()
        val cleanBody = body.trim()
        if (cleanSubject.length < 3 || cleanBody.isBlank() || creating) return
        creating = true
        error = null
        try {
            val ticketId = supabase.postgrest.rpc(
                "create_support_ticket",
                buildJsonObject {
                    put("p_subject", JsonPrimitive(cleanSubject))
                    put("p_category", JsonPrimitive(category))
                    put("p_body", JsonPrimitive(cleanBody))
                }
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
                        if (staff) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Box {
                                    TextButton(onClick = { statusExpanded = true }, enabled = !updatingTicket) { Text("تغییر وضعیت") }
                                    DropdownMenu(expanded = statusExpanded, onDismissRequest = { statusExpanded = false }) {
                                        listOf("open" to "جدید", "in_progress" to "در حال بررسی", "waiting_user" to "منتظر پاسخ کاربر", "resolved" to "حل‌شده", "closed" to "بسته‌شده").forEach { (value, label) ->
                                            DropdownMenuItem(text = { Text(label) }, onClick = {
                                                statusExpanded = false
                                                scope.launch { updateTicketField(selected!!, "status", value) }
                                            })
                                        }
                                    }
                                }
                                Box {
                                    TextButton(onClick = { priorityExpanded = true }, enabled = !updatingTicket) { Text("تغییر اولویت") }
                                    DropdownMenu(expanded = priorityExpanded, onDismissRequest = { priorityExpanded = false }) {
                                        listOf("low" to "پایین", "normal" to "عادی", "high" to "بالا", "urgent" to "فوری").forEach { (value, label) ->
                                            DropdownMenuItem(text = { Text(label) }, onClick = {
                                                priorityExpanded = false
                                                scope.launch { updateTicketField(selected!!, "priority", value) }
                                            })
                                        }
                                    }
                                }
                            }
                        }
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
                        Box {
                            OutlinedButton(
                                onClick = { categoryExpanded = true },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("دسته‌بندی: ${supportCategories.first { it.first == category }.second}")
                            }
                            DropdownMenu(
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

            OutlinedTextField(
                value = ticketSearch,
                onValueChange = { ticketSearch = it.take(160) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                label = { Text(if (staff) "جست‌وجوی موضوع، درخواست‌دهنده یا شناسه" else "جست‌وجو در درخواست‌ها") }
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(7.dp)
            ) {
                FilterChip(selected = ticketStatusFilter == "all", onClick = { ticketStatusFilter = "all" }, label = { Text("همه ${tickets.size}") })
                FilterChip(selected = ticketStatusFilter == "open", onClick = { ticketStatusFilter = "open" }, label = { Text("جدید ${tickets.count { it.status == "open" }}") })
                FilterChip(selected = ticketStatusFilter == "in_progress", onClick = { ticketStatusFilter = "in_progress" }, label = { Text("در بررسی ${tickets.count { it.status == "in_progress" }}") })
                FilterChip(selected = ticketStatusFilter == "waiting_user", onClick = { ticketStatusFilter = "waiting_user" }, label = { Text("منتظر کاربر ${tickets.count { it.status == "waiting_user" }}") })
                FilterChip(selected = ticketStatusFilter == "resolved", onClick = { ticketStatusFilter = "resolved" }, label = { Text("حل‌شده ${tickets.count { it.status == "resolved" }}") })
                FilterChip(selected = ticketStatusFilter == "closed", onClick = { ticketStatusFilter = "closed" }, label = { Text("بسته ${tickets.count { it.status == "closed" }}") })
            }
            if (staff) {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(7.dp)
                ) {
                    FilterChip(selected = ticketPriorityFilter == "all", onClick = { ticketPriorityFilter = "all" }, label = { Text("همه اولویت‌ها") })
                    FilterChip(selected = ticketPriorityFilter == "urgent", onClick = { ticketPriorityFilter = "urgent" }, label = { Text("فوری ${tickets.count { it.priority == "urgent" }}") })
                    FilterChip(selected = ticketPriorityFilter == "high", onClick = { ticketPriorityFilter = "high" }, label = { Text("بالا ${tickets.count { it.priority == "high" }}") })
                    FilterChip(selected = ticketPriorityFilter == "normal", onClick = { ticketPriorityFilter = "normal" }, label = { Text("عادی ${tickets.count { it.priority == "normal" }}") })
                    FilterChip(selected = ticketPriorityFilter == "low", onClick = { ticketPriorityFilter = "low" }, label = { Text("پایین ${tickets.count { it.priority == "low" }}") })
                }
            }

            if (loading) {
                CircularProgressIndicator()
            } else if (filteredTickets.isEmpty()) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = MaterialTheme.shapes.large
                ) {
                    Text(
                        when {
                            tickets.isEmpty() && staff -> "درخواستی برای نمایش وجود ندارد."
                            tickets.isEmpty() -> "هنوز درخواستی ثبت نکرده‌اید."
                            else -> "درخواستی با این فیلتر یا عبارت جست‌وجو پیدا نشد."
                        },
                        modifier = Modifier.padding(18.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(filteredTickets, key = { it.id }) { ticket ->
                        Card(
                            onClick = { selected = ticket },
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                Text(ticket.subject, fontWeight = FontWeight.SemiBold)
                                if (staff) Text("درخواست‌دهنده: ${ticket.requesterLabel ?: ticket.requesterId.take(8)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                                    Surface(
                                        color = MaterialTheme.colorScheme.secondaryContainer,
                                        shape = MaterialTheme.shapes.small
                                    ) {
                                        Text(
                                            supportStatusLabel(ticket.status),
                                            modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSecondaryContainer
                                        )
                                    }
                                    Surface(
                                        color = if (ticket.priority == "urgent" || ticket.priority == "high")
                                            MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.surfaceVariant,
                                        shape = MaterialTheme.shapes.small
                                    ) {
                                        Text(
                                            "اولویت ${when (ticket.priority) { "urgent" -> "فوری"; "high" -> "بالا"; "low" -> "پایین"; else -> "عادی" }}",
                                            modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (ticket.priority == "urgent" || ticket.priority == "high")
                                                MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                Text(
                                    supportCategories.firstOrNull { it.first == ticket.category }?.second ?: ticket.category,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
