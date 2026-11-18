package com.kaveh.avenger.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import android.provider.OpenableColumns
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kaveh.avenger.data.SupabaseClientProvider
import com.kaveh.avenger.files.FileUploadRepository
import com.kaveh.avenger.files.MAX_UPLOAD_BYTES
import com.kaveh.avenger.files.UploadedFile
import kotlinx.coroutines.launch

@Composable
fun FileUploadScreen(userId: String) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedUri by remember { mutableStateOf<Uri?>(null) }
    var uploading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var uploaded by remember { mutableStateOf<UploadedFile?>(null) }
    val selectedName = remember(selectedUri) {
        selectedUri?.let { uri ->
            context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
            } ?: uri.lastPathSegment
        }
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        selectedUri = uri
        error = null
        uploaded = null
    }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("رسانه و فایل", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.SemiBold)
        Text("فضای ابری خصوصی", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        OutlinedCard(shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("هر نوع فایل", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                Text(
                    "انتخاب‌گر سیستم برای همهٔ نوع فایل باز می‌شود؛ پسوند فایل محدود نشده است. نام اصلی فارسی و Unicode در متادیتا نگهداری می‌شود و مسیر ذخیره‌سازی با شناسهٔ امن ساخته می‌شود.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text("سقف قطعی هر فایل: ${MAX_UPLOAD_BYTES / 1_000_000} MB", style = MaterialTheme.typography.labelLarge)
                OutlinedButton(
                    onClick = { picker.launch(arrayOf("*/*")) },
                    enabled = !uploading,
                    modifier = Modifier.fillMaxWidth()
                ) { Text(if (selectedUri == null) "انتخاب فایل از دستگاه" else "انتخاب فایل دیگر") }
                if (selectedUri != null) {
                    Text(selectedName ?: "فایل انتخاب شد", style = MaterialTheme.typography.bodyMedium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Button(
                        onClick = {
                            val uri = selectedUri ?: return@Button
                            scope.launch {
                                uploading = true
                                error = null
                                uploaded = null
                                try {
                                    uploaded = FileUploadRepository(SupabaseClientProvider.client).upload(context, userId, uri)
                                } catch (exception: Exception) {
                                    error = exception.localizedMessage ?: "آپلود فایل انجام نشد."
                                } finally {
                                    uploading = false
                                }
                            }
                        },
                        enabled = !uploading,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (uploading) {
                            CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.size(8.dp))
                            Text("در حال آپلود…")
                        } else Text("آپلود در فضای خصوصی")
                    }
                }
            }
        }
        if (uploading) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                Text("در حال انتقال امن فایل…", style = MaterialTheme.typography.bodySmall)
            }
        }
        uploaded?.let { file ->
            OutlinedCard(shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("آپلود ثبت شد", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text(file.originalName, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text("${file.byteSize} بایت", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("SHA-256: ${file.sha256.take(20)}…", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        if (!error.isNullOrBlank()) {
            Text(error.orEmpty(), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
        Text(
            "در این نسخه آپلود مستقیم و کنترل حجم فعال است. درصد پیشرفت، صف پس‌زمینه، ادامه پس از قطع شبکه و دانلود/اشتراک با مجوز اعضا در مرحلهٔ بعد ساخته می‌شوند.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
