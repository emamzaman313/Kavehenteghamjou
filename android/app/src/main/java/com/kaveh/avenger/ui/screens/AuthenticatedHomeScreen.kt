package com.kaveh.avenger.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.PlayCircleOutline
import androidx.compose.material.icons.outlined.MusicNote
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.Badge
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.OutlinedCard
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kaveh.avenger.R
import com.kaveh.avenger.data.SupabaseClientProvider
import com.kaveh.avenger.notifications.PushTokenRegistration
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.coroutines.launch

private enum class MainTab(val title: String) {
    Home("خانه"), Chats("گفتگوها"), Support("پشتیبانی"), Publish("انتشار"), Explore("اکتشاف"), Reels("ریلز"), Media("موسیقی"), Communities("گروه‌ها"), Notifications("اعلان‌ها"), World("جهان"), Admin("مدیریت"), Profile("پروفایل")
}

@Serializable
private data class MobileFeatureFlagRow(val key:String,val enabled:Boolean)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthenticatedHomeScreen(email: String?, userId: String, onSignOut: suspend () -> Unit) {
    val scope = rememberCoroutineScope()
    var selectedTab by remember { mutableStateOf(MainTab.Home) }
    var adminRole by remember { mutableStateOf<String?>(null) }
    var rankNames by remember { mutableStateOf<List<String>>(emptyList()) }
    var featureFlags by remember { mutableStateOf<Map<String,Boolean>>(emptyMap()) }
    LaunchedEffect(userId) {
        adminRole = runCatching {
            SupabaseClientProvider.client.postgrest.rpc("my_admin_role").decodeAs<JsonObject>()["role"]?.jsonPrimitive?.contentOrNull
        }.getOrNull()
        featureFlags = runCatching { SupabaseClientProvider.client.postgrest["platform_feature_flags"].select().decodeList<MobileFeatureFlagRow>().associate { it.key to it.enabled } }.getOrDefault(emptyMap())
        rankNames = runCatching {
            SupabaseClientProvider.client.postgrest.rpc("my_kaveh_ranks").decodeAs<kotlinx.serialization.json.JsonArray>()
                .mapNotNull { item -> item.jsonObject["name_fa"]?.jsonPrimitive?.contentOrNull }
        }.getOrDefault(emptyList())
    }
    val isAdmin = adminRole in setOf("owner","admin","moderator")
    fun featureOn(key:String)=isAdmin || featureFlags[key] != false
    val tabs = MainTab.entries.filter { tab ->
        if(tab==MainTab.Admin || tab==MainTab.World) false else when(tab) {
            MainTab.Chats, MainTab.Communities -> featureOn("chat")
            MainTab.Support -> featureOn("support")
            MainTab.Publish -> featureOn("posts")
            MainTab.Explore -> featureOn("social_discovery")
            MainTab.Reels -> featureOn("reels")
            MainTab.Media -> featureOn("uploads")
            else -> true
        }
    }
    LaunchedEffect(featureFlags) {
        val key=when(selectedTab) {
            MainTab.Chats,MainTab.Communities -> "chat"
            MainTab.Support -> "support"
            MainTab.Publish -> "posts"
            MainTab.Explore -> "social_discovery"
            MainTab.Reels -> "reels"
            MainTab.Media -> "uploads"
            else -> null
        }
        if(key!=null && featureFlags[key]==false && !isAdmin) selectedTab=MainTab.Profile
    }
    PushTokenRegistration(supabase = SupabaseClientProvider.client, userId = userId)

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        contentWindowInsets = WindowInsets.navigationBars,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Image(
                            painter = painterResource(R.drawable.ic_launcher),
                            contentDescription = "نماد کاوه انتقامجو",
                            modifier = Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)),
                            contentScale = ContentScale.Crop
                        )
                        Spacer(Modifier.width(10.dp))
                        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                            Text("کاوه انتقامجو", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleLarge)
                            Text(
                                "فضای شخصی ارتباط و رسانه",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                actions = {
                    TextButton(onClick = { selectedTab = MainTab.World }) { Text("جهان") }
                    if (adminRole != null) TextButton(onClick = { selectedTab = MainTab.Admin }) { Text("مدیریت") }
                    TextButton(onClick = { scope.launch { onSignOut() } }) { Text("خروج") }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.97f),
                    scrolledContainerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 10.dp) {
                tabs.forEachIndexed { index, tab ->
                    val icon = when (tab) {
                        MainTab.Home -> Icons.Outlined.Home
                        MainTab.Chats -> Icons.Outlined.ChatBubbleOutline
                        MainTab.Support -> Icons.Outlined.SupportAgent
                        MainTab.Publish -> Icons.Outlined.AddCircleOutline
                        MainTab.Explore -> Icons.Outlined.Explore
                        MainTab.Reels -> Icons.Outlined.PlayCircleOutline
                        MainTab.Media -> Icons.Outlined.MusicNote
                        MainTab.Communities -> Icons.Outlined.ChatBubbleOutline
                        MainTab.Notifications -> Icons.Outlined.Notifications
                        MainTab.World -> Icons.Outlined.Explore
                        MainTab.Admin -> Icons.Outlined.PersonOutline
                        MainTab.Profile -> Icons.Outlined.PersonOutline
                    }
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = { Icon(icon, contentDescription = tab.title) },
                        label = { Text(tab.title, maxLines = 1) }
                    )
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            MaterialTheme.colorScheme.background,
                            MaterialTheme.colorScheme.surface.copy(alpha = 0.84f),
                            MaterialTheme.colorScheme.background
                        )
                    )
                )
                .padding(padding)
                .padding(horizontal = 20.dp)
        ) {
            Spacer(Modifier.height(14.dp))
            when (selectedTab) {
                MainTab.Home -> HomeOverview(email, rankNames)
                MainTab.Chats -> ChatScreen(
                    supabase = SupabaseClientProvider.client,
                    userId = userId
                )
                MainTab.Support -> SupportCenterScreen(
                    supabase = SupabaseClientProvider.client,
                    userId = userId,
                    staff = adminRole in setOf("owner", "admin", "support")
                )
                MainTab.Publish -> PublishPostScreen(supabase = SupabaseClientProvider.client, userId = userId)
                MainTab.Explore -> ExploreFeedScreen(supabase = SupabaseClientProvider.client, userId = userId)
                MainTab.Reels -> ReelsScreen(supabase = SupabaseClientProvider.client, userId = userId)
                MainTab.Media -> AudioAndDailyScreen(supabase = SupabaseClientProvider.client, userId = userId)
                MainTab.Communities -> CommunitiesScreen(supabase = SupabaseClientProvider.client, userId = userId)
                MainTab.Notifications -> NotificationsScreen(supabase = SupabaseClientProvider.client, userId = userId)
                MainTab.World -> KavehWorldScreen(supabase = SupabaseClientProvider.client, userId = userId, isAdmin = adminRole in setOf("owner", "admin", "moderator"))
                MainTab.Admin -> AdminConsoleScreen(supabase = SupabaseClientProvider.client, role = adminRole ?: "support")
                MainTab.Profile -> EditableProfileScreen(supabase = SupabaseClientProvider.client, userId = userId, email = email)
            }
            Spacer(Modifier.height(18.dp))
        }
    }
}

@Composable
private fun HomeOverview(email: String?, rankNames: List<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(30.dp),
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.36f)),
            tonalElevation = 6.dp,
            shadowElevation = 13.dp
        ) {
            Box(
                modifier = Modifier
                    .background(
                        Brush.linearGradient(
                            listOf(
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.28f),
                                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.72f),
                                MaterialTheme.colorScheme.secondary.copy(alpha = 0.13f)
                            )
                        )
                    )
                    .padding(22.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Surface(color = MaterialTheme.colorScheme.primary.copy(alpha = 0.14f), shape = CircleShape) {
                        Text("فضای اختصاصی شما", modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    }
                    Text("خوش آمدی", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.ExtraBold, color = MaterialTheme.colorScheme.onSurface)
                    Text(
                        email ?: "حساب Google متصل است",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        "هویت شما با Google تأیید شده و نشست مستقل برنامه در Supabase برقرار است.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
            }
        }

        if (rankNames.isNotEmpty()) {
            OutlinedCard(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("رتبه‌های حساب شما", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(rankNames.joinToString(" · "), color = MaterialTheme.colorScheme.primary)
                }
            }
        }
        Text("وضعیت بخش‌ها", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        StatusCard(
            title = "پایگاه داده و دسترسی‌ها",
            subtitle = "۲۶ جدول مستقل با Row Level Security",
            badge = "آماده",
            complete = true
        )
        StatusCard(
            title = "فضای فایل خصوصی",
            subtitle = "حداکثر ۵۰٬۰۰۰٬۰۰۰ بایت برای هر فایل",
            badge = "آمادهٔ زیرساخت",
            complete = true
        )
        StatusCard(
            title = "پیام‌رسانی و شبکه اجتماعی",
            subtitle = "گفتگوی متنی و Realtime به Supabase متصل شده؛ پیوست و امکانات پیشرفته در حال تکمیل است",
            badge = "در حال توسعه",
            complete = false
        )
        Text(
            "این صفحه وضعیت واقعی زیرساخت را نشان می‌دهد؛ محتوای آزمایشی یا گفتگوی ساختگی نمایش داده نمی‌شود.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun StatusCard(title: String, subtitle: String, badge: String, complete: Boolean) {
    OutlinedCard(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.outlinedCardColors(containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f)),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.32f))
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(46.dp).clip(RoundedCornerShape(15.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(
                                MaterialTheme.colorScheme.primary.copy(alpha = 0.22f),
                                MaterialTheme.colorScheme.secondary.copy(alpha = 0.11f)
                            )
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(if (complete) "✓" else "…", color = if (complete) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.secondary, fontWeight = FontWeight.ExtraBold)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.width(8.dp))
            Badge(containerColor = (if (complete) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.secondary).copy(alpha = 0.15f), contentColor = if (complete) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.secondary) {
                Text(badge, modifier = Modifier.padding(horizontal = 3.dp, vertical = 2.dp), style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun ModulePlaceholder(eyebrow: String, title: String, description: String, status: String, detail: String? = null) {
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        Text(eyebrow, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        OutlinedCard(shape = RoundedCornerShape(26.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(description, style = MaterialTheme.typography.bodyLarge)
                if (!detail.isNullOrBlank()) {
                    Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
        ) {
            Text(status, modifier = Modifier.fillMaxWidth().padding(15.dp), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
        }
    }
}
