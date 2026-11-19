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
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
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
import java.time.Instant
import java.util.UUID

@Serializable
private data class WorldMissionRow(
    val id: String,
    val code: String,
    val title: String,
    val description: String,
    @SerialName("action_key") val actionKey: String,
    @SerialName("target_count") val targetCount: Int,
    @SerialName("reward_points") val rewardPoints: Int,
    @SerialName("reward_badge_code") val rewardBadgeCode: String? = null,
    val active: Boolean,
    @SerialName("starts_at") val startsAt: String = "",
    @SerialName("ends_at") val endsAt: String? = null,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = ""
)

@Serializable
private data class WorldProgressRow(
    @SerialName("mission_id") val missionId: String,
    @SerialName("progress_count") val progressCount: Int,
    @SerialName("completed_at") val completedAt: String? = null,
    @SerialName("reward_claimed_at") val rewardClaimedAt: String? = null,
    @SerialName("updated_at") val updatedAt: String = ""
)

@Serializable
private data class WorldEventRow(
    val id: String,
    val title: String,
    val summary: String,
    val body: String,
    val category: String,
    val status: String,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("ends_at") val endsAt: String? = null,
    @SerialName("points_reward") val pointsReward: Int,
    @SerialName("participant_count") val participantCount: Int = 0,
    @SerialName("banner_path") val bannerPath: String? = null,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("created_at") val createdAt: String = "",
    @SerialName("updated_at") val updatedAt: String = ""
)

@Serializable
private data class WorldParticipantRow(
    @SerialName("event_id") val eventId: String,
    @SerialName("user_id") val userId: String,
    @SerialName("joined_at") val joinedAt: String = ""
)

@Serializable
private data class WorldRankRow(
    @SerialName("user_id") val userId: String,
    val score: Long,
    @SerialName("rank_code") val rankCode: String,
    @SerialName("updated_at") val updatedAt: String = ""
)

@Serializable
private data class WorldRankLevelRow(
    val code: String,
    val title: String,
    @SerialName("min_score") val minScore: Long,
    @SerialName("sort_order") val sortOrder: Int = 0,
    @SerialName("accent_token") val accentToken: String = "neutral"
)

@Serializable
private data class WorldBadgeRow(
    val code: String,
    val title: String,
    val description: String,
    @SerialName("icon_key") val iconKey: String,
    @SerialName("accent_token") val accentToken: String
)

@Serializable
private data class WorldUserBadgeRow(
    @SerialName("badge_code") val badgeCode: String,
    @SerialName("awarded_at") val awardedAt: String = "",
    @SerialName("awarded_by") val awardedBy: String? = null
)

@Serializable
private data class WorldBadgeInsert(
    val code: String,
    val title: String,
    val description: String,
    @SerialName("icon_key") val iconKey: String = "award",
    @SerialName("accent_token") val accentToken: String = "gold"
)

@Serializable
private data class WorldUserBadgeInsert(
    @SerialName("user_id") val userId: String,
    @SerialName("badge_code") val badgeCode: String,
    @SerialName("awarded_by") val awardedBy: String
)

@Serializable
private data class WorldMissionInsert(
    val code: String,
    val title: String,
    val description: String,
    @SerialName("action_key") val actionKey: String,
    @SerialName("target_count") val targetCount: Int,
    @SerialName("reward_points") val rewardPoints: Int,
    val active: Boolean = true,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("created_by") val createdBy: String,
    @SerialName("reward_badge_code") val rewardBadgeCode: String? = null
)

@Serializable
private data class WorldEventInsert(
    val title: String,
    val summary: String,
    val body: String,
    val category: String,
    val status: String = "published",
    @SerialName("starts_at") val startsAt: String,
    @SerialName("points_reward") val pointsReward: Int,
    @SerialName("created_by") val createdBy: String
)

@Serializable
private data class WorldParticipantInsert(
    @SerialName("event_id") val eventId: String,
    @SerialName("user_id") val userId: String
)

@Composable
fun KavehWorldScreen(supabase: SupabaseClient, userId: String, isAdmin: Boolean) {
    val scope = rememberCoroutineScope()
    val missions = remember { mutableStateListOf<WorldMissionRow>() }
    val events = remember { mutableStateListOf<WorldEventRow>() }
    val progress = remember { mutableStateListOf<WorldProgressRow>() }
    val joined = remember { mutableStateListOf<String>() }
    val ranking = remember { mutableStateListOf<WorldRankRow>() }
    val rankLevels = remember { mutableStateListOf<WorldRankLevelRow>() }
    val badges = remember { mutableStateListOf<WorldBadgeRow>() }
    val myBadgeCodes = remember { mutableStateListOf<String>() }
    var score by remember { mutableStateOf(0L) }
    var rankTitle by remember { mutableStateOf("تازه‌وارد") }
    var loading by remember { mutableStateOf(true) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var missionTitle by remember { mutableStateOf("") }
    var missionDescription by remember { mutableStateOf("") }
    var missionAction by remember { mutableStateOf("publish_post") }
    var missionTarget by remember { mutableStateOf("1") }
    var missionReward by remember { mutableStateOf("25") }
    var missionBadgeCode by remember { mutableStateOf("") }
    var eventTitle by remember { mutableStateOf("") }
    var eventSummary by remember { mutableStateOf("") }
    var eventBody by remember { mutableStateOf("") }
    var eventCategory by remember { mutableStateOf("community") }
    var badgeCode by remember { mutableStateOf("") }
    var badgeTitle by remember { mutableStateOf("") }
    var badgeDescription by remember { mutableStateOf("") }
    var awardUserId by remember { mutableStateOf("") }
    var selectedBadgeCode by remember { mutableStateOf("") }

    suspend fun refresh() {
        loading = true
        error = null
        try {
            val missionRows = supabase.postgrest["daily_missions"].select {
                filter { eq("active", true) }
            }.decodeList<WorldMissionRow>()
            val progressRows = supabase.postgrest["mission_progress"].select {
                filter { eq("user_id", userId) }
            }.decodeList<WorldProgressRow>()
            val eventRows = supabase.postgrest["platform_events"].select {
                if (!isAdmin) filter { eq("status", "published") }
            }.decodeList<WorldEventRow>()
            val participantRows = supabase.postgrest["platform_event_participants"].select {
                filter { eq("user_id", userId) }
            }.decodeList<WorldParticipantRow>()
            val rankRows = supabase.postgrest["user_rank_state"].select {
                order(column = "score", order = io.github.jan.supabase.postgrest.query.Order.DESCENDING)
                limit(10)
            }.decodeList<WorldRankRow>()
            val levelRows = supabase.postgrest["rank_levels"].select().decodeList<WorldRankLevelRow>()
            val badgeRows = supabase.postgrest["badges"].select().decodeList<WorldBadgeRow>()
            val ownBadges = supabase.postgrest["user_badges"].select { filter { eq("user_id", userId) } }.decodeList<WorldUserBadgeRow>()
            val ownRank = rankRows.firstOrNull { it.userId == userId }
                ?: supabase.postgrest["user_rank_state"].select {
                    filter { eq("user_id", userId) }
                }.decodeList<WorldRankRow>().firstOrNull()
            score = ownRank?.score ?: 0L
            rankTitle = levelRows.filter { it.minScore <= score }.maxByOrNull { it.minScore }?.title ?: "تازه‌وارد"
            missions.clear(); missions.addAll(missionRows)
            progress.clear(); progress.addAll(progressRows)
            events.clear(); events.addAll(eventRows)
            joined.clear(); joined.addAll(participantRows.map { it.eventId })
            ranking.clear(); ranking.addAll(rankRows)
            rankLevels.clear(); rankLevels.addAll(levelRows)
            badges.clear(); badges.addAll(badgeRows)
            myBadgeCodes.clear(); myBadgeCodes.addAll(ownBadges.map { it.badgeCode })
        } catch (exception: Exception) {
            error = exception.message ?: "دریافت جهان کاوه ناموفق بود."
        } finally {
            loading = false
        }
    }

    LaunchedEffect(userId, isAdmin) { refresh() }

    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(26.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("KAVEH UNIVERSE", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                Text("جهان کاوه", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.ExtraBold)
                Text("با مشارکت واقعی رشد کن، مأموریت‌ها را کامل کن و در جامعه بدرخش.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.primary.copy(alpha = .12f)) {
                        Column(Modifier.padding(12.dp)) {
                            Text("$score XP", fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.primary)
                            Text("امتیاز تو", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    Surface(shape = RoundedCornerShape(14.dp), color = MaterialTheme.colorScheme.secondary.copy(alpha = .12f)) {
                        Column(Modifier.padding(12.dp)) {
                            Text(rankTitle, fontWeight = FontWeight.Bold)
                            Text("رتبه فعلی", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("مأموریت‌های فعال", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            OutlinedButton(onClick = { scope.launch { refresh() } }, enabled = !loading) { Text("به‌روزرسانی") }
        }
        if (loading) {
            CircularProgressIndicator()
        } else if (error != null) {
            Text(error!!, color = MaterialTheme.colorScheme.error)
            Button(onClick = { scope.launch { refresh() } }) { Text("تلاش دوباره") }
        } else {
            LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(missions, key = { it.id }) { mission ->
                    val state = progress.firstOrNull { it.missionId == mission.id }
                    val count = minOf(state?.progressCount ?: 0, mission.targetCount)
                    val done = state?.completedAt != null
                    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(mission.title, fontWeight = FontWeight.Bold)
                                Text(if (done) "✓ تکمیل شد" else "+${mission.rewardPoints} XP", color = if (done) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                            }
                            Text(mission.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                            Text("$count از ${mission.targetCount} · ${mission.actionKey}" + (mission.rewardBadgeCode?.let { code -> " · نشان: " + (badges.firstOrNull { it.code == code }?.title ?: code) } ?: ""), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                            if (isAdmin) {
                                TextButton(onClick = {
                                    scope.launch {
                                        busy = true
                                        try {
                                            supabase.postgrest["daily_missions"].update({ set("active", !mission.active) }) { filter { eq("id", mission.id) } }
                                            refresh()
                                        } catch (exception: Exception) { error = exception.message ?: "تغییر وضعیت مأموریت ناموفق بود." }
                                        finally { busy = false }
                                    }
                                }, enabled = !busy) { Text(if (mission.active) "توقف مأموریت" else "فعال‌سازی مأموریت") }
                            }
                        }
                    }
                }
                item { Text("رویدادهای جامعه", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                items(events, key = { it.id }) { event ->
                    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(event.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            if (event.summary.isNotBlank()) Text(event.summary, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("شروع: ${event.startsAt.take(16).replace("T", " ")} · ${event.participantCount} شرکت‌کننده", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (event.pointsReward > 0) Text("جایزه اعلام‌شده: ${event.pointsReward} XP", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelSmall)
                            if (event.status == "published") {
                                OutlinedButton(
                                    onClick = {
                                        scope.launch {
                                            busy = true
                                            try {
                                                if (joined.contains(event.id)) {
                                                    supabase.postgrest["platform_event_participants"].delete {
                                                        filter { eq("event_id", event.id); eq("user_id", userId) }
                                                    }
                                                    joined.remove(event.id)
                                                } else {
                                                    supabase.postgrest["platform_event_participants"].insert(WorldParticipantInsert(event.id, userId))
                                                    joined.add(event.id)
                                                }
                                            } catch (exception: Exception) {
                                                error = exception.message ?: "تغییر عضویت رویداد ناموفق بود."
                                            } finally { busy = false }
                                        }
                                    },
                                    enabled = !busy
                                ) { Text(if (joined.contains(event.id)) "خروج از رویداد" else "شرکت در رویداد") }
                            }
                            if (isAdmin && event.status == "published") {
                                OutlinedButton(onClick = {
                                    scope.launch {
                                        busy = true
                                        try {
                                            supabase.postgrest["platform_events"].update({ set("status", "archived") }) { filter { eq("id", event.id) } }
                                            refresh()
                                        } catch (exception: Exception) { error = exception.message ?: "پایان رویداد ناموفق بود." }
                                        finally { busy = false }
                                    }
                                }, enabled = !busy) { Text("پایان رویداد و توزیع جایزه") }
                            }
                        }
                    }
                }
                item { Text("تالار افتخار", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                items(badges, key = { it.code }) { badge ->
                    Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text("🏅 ${badge.title}", fontWeight = FontWeight.Bold)
                                if (badge.description.isNotBlank()) Text(badge.description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                            }
                            Text(if (myBadgeCodes.contains(badge.code)) "دریافت‌شده" else "ویژه", color = if (myBadgeCodes.contains(badge.code)) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
                if (isAdmin) {
                    item {
                        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("کنترل مدیریتی جهان کاوه", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                                Text("ساخت مأموریت سراسری", style = MaterialTheme.typography.titleMedium)
                                OutlinedTextField(missionTitle, { missionTitle = it }, label = { Text("عنوان مأموریت") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                OutlinedTextField(missionDescription, { missionDescription = it }, label = { Text("توضیحات") }, modifier = Modifier.fillMaxWidth())
                                OutlinedTextField(missionAction, { missionAction = it }, label = { Text("عملیات: publish_post / react_post / comment_post / publish_reel") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    OutlinedTextField(missionTarget, { missionTarget = it.filter(Char::isDigit).take(3) }, label = { Text("هدف") }, modifier = Modifier.weight(1f), singleLine = true)
                                    OutlinedTextField(missionReward, { missionReward = it.filter(Char::isDigit).take(5) }, label = { Text("امتیاز") }, modifier = Modifier.weight(1f), singleLine = true)
                                }
                                OutlinedTextField(missionBadgeCode, { missionBadgeCode = it.trim().take(48) }, label = { Text("کد نشان جایزه (اختیاری)") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Button(
                                    onClick = {
                                        scope.launch {
                                            val target = missionTarget.toIntOrNull() ?: 0
                                            val reward = missionReward.toIntOrNull() ?: -1
                                            if (missionTitle.trim().length < 3 || missionAction !in setOf("publish_post", "react_post", "comment_post", "publish_reel") || target !in 1..100 || reward !in 0..10000) {
                                                error = "اطلاعات مأموریت معتبر نیست."
                                                return@launch
                                            }
                                            busy = true
                                            try {
                                                supabase.postgrest["daily_missions"].insert(WorldMissionInsert("android-${UUID.randomUUID()}", missionTitle.trim(), missionDescription.trim(), missionAction, target, reward, true, Instant.now().toString(), userId, missionBadgeCode.ifBlank { null }))
                                                missionTitle = ""; missionDescription = ""; missionBadgeCode = ""; refresh()
                                            } catch (exception: Exception) { error = exception.message ?: "ساخت مأموریت ناموفق بود." }
                                            finally { busy = false }
                                        }
                                    },
                                    enabled = !busy && missionTitle.trim().length >= 3,
                                    modifier = Modifier.fillMaxWidth()
                                ) { Text("انتشار مأموریت") }
                                Spacer(Modifier.height(4.dp))
                                Text("ساخت رویداد سراسری", style = MaterialTheme.typography.titleMedium)
                                OutlinedTextField(eventTitle, { eventTitle = it }, label = { Text("عنوان رویداد") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                OutlinedTextField(eventSummary, { eventSummary = it }, label = { Text("خلاصه") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                OutlinedTextField(eventBody, { eventBody = it }, label = { Text("جزئیات و قوانین") }, modifier = Modifier.fillMaxWidth())
                                OutlinedTextField(eventCategory, { eventCategory = it }, label = { Text("دسته: community / competition / announcement / challenge / live") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Button(
                                    onClick = {
                                        scope.launch {
                                            if (eventTitle.trim().length < 3 || eventCategory !in setOf("community", "competition", "announcement", "challenge", "live")) {
                                                error = "عنوان یا دسته‌بندی رویداد معتبر نیست."
                                                return@launch
                                            }
                                            busy = true
                                            try {
                                                supabase.postgrest["platform_events"].insert(WorldEventInsert(eventTitle.trim(), eventSummary.trim(), eventBody.trim(), eventCategory, "published", Instant.now().toString(), 0, userId))
                                                eventTitle = ""; eventSummary = ""; eventBody = ""; refresh()
                                            } catch (exception: Exception) { error = exception.message ?: "ساخت رویداد ناموفق بود." }
                                            finally { busy = false }
                                        }
                                    },
                                    enabled = !busy && eventTitle.trim().length >= 3,
                                    modifier = Modifier.fillMaxWidth()
                                ) { Text("انتشار رویداد") }
                                Spacer(Modifier.height(10.dp))
                                Text("مدیریت نشان‌های افتخار", style = MaterialTheme.typography.titleMedium)
                                OutlinedTextField(badgeCode, { badgeCode = it.lowercase().filter { ch -> ch.isLetterOrDigit() || ch == '-' || ch == '_' }.take(48) }, label = { Text("کد لاتین نشان") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                OutlinedTextField(badgeTitle, { badgeTitle = it }, label = { Text("عنوان نشان") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                OutlinedTextField(badgeDescription, { badgeDescription = it }, label = { Text("توضیحات نشان") }, modifier = Modifier.fillMaxWidth())
                                Button(onClick = {
                                    scope.launch {
                                        if (badgeCode.length < 3 || badgeTitle.trim().length < 2) { error = "کد یا عنوان نشان معتبر نیست."; return@launch }
                                        busy = true
                                        try {
                                            supabase.postgrest["badges"].insert(WorldBadgeInsert(badgeCode, badgeTitle.trim(), badgeDescription.trim()))
                                            badgeCode = ""; badgeTitle = ""; badgeDescription = ""; refresh()
                                        } catch (exception: Exception) { error = exception.message ?: "ساخت نشان ناموفق بود." }
                                        finally { busy = false }
                                    }
                                }, enabled = !busy && badgeCode.length >= 3 && badgeTitle.trim().length >= 2, modifier = Modifier.fillMaxWidth()) { Text("ساخت نشان") }
                                OutlinedTextField(awardUserId, { awardUserId = it.trim() }, label = { Text("شناسه UUID کاربر") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                OutlinedTextField(selectedBadgeCode, { selectedBadgeCode = it }, label = { Text("کد نشان برای اعطا") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                                Button(onClick = {
                                    scope.launch {
                                        if (awardUserId.isBlank() || selectedBadgeCode.isBlank()) { error = "شناسه کاربر و کد نشان لازم است."; return@launch }
                                        busy = true
                                        try {
                                            supabase.postgrest["user_badges"].insert(WorldUserBadgeInsert(awardUserId, selectedBadgeCode, userId))
                                            awardUserId = ""; selectedBadgeCode = ""; refresh()
                                        } catch (exception: Exception) { error = exception.message ?: "اعطای نشان ناموفق بود." }
                                        finally { busy = false }
                                    }
                                }, enabled = !busy && awardUserId.isNotBlank() && selectedBadgeCode.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("اعطای نشان") }
                            }
                        }
                    }
                }
                item { Text("برترین امتیازها", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold) }
                items(ranking, key = { it.userId }) { row ->
                    Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                        Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(row.rankCode, fontWeight = FontWeight.SemiBold)
                            Text("${row.score} XP", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
