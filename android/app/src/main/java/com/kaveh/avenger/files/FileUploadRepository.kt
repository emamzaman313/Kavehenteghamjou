package com.kaveh.avenger.files

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import io.ktor.http.ContentType
import kotlinx.serialization.Serializable
import java.io.ByteArrayOutputStream
import java.security.MessageDigest
import java.util.UUID

const val MAX_UPLOAD_BYTES: Long = 50_000_000L

@Serializable
private data class FileAssetInsert(
    val owner_id: String,
    val bucket_id: String = "user-files",
    val object_path: String,
    val original_name: String,
    val mime_type: String? = null,
    val byte_size: Long,
    val sha256_hex: String,
    val status: String = "ready"
)

data class UploadedFile(
    val fileAssetId: String,
    val originalName: String,
    val byteSize: Long,
    val objectPath: String,
    val sha256: String
)

@Serializable
data class VaultFile(
    val id: String,
    val owner_id: String,
    val bucket_id: String,
    val object_path: String,
    val original_name: String,
    val mime_type: String? = null,
    val byte_size: Long,
    val sha256_hex: String,
    val status: String,
    val created_at: String
)

@Serializable
private data class FileAssetIdRow(val id: String)

class FileTooLargeException(maxBytes: Long) :
    IllegalArgumentException("حجم فایل از سقف ${maxBytes / 1_000_000} مگابایت بیشتر است.")

/**
 * Uploads arbitrary document-picker content into the authenticated user's private folder.
 * The object path is generated internally; the original Unicode filename is metadata only.
 */
class FileUploadRepository(private val supabase: SupabaseClient) {

    suspend fun upload(context: Context, ownerId: String, uri: Uri, onProgress: (Int, String) -> Unit = { _, _ -> }): UploadedFile {
        require(ownerId.isNotBlank()) { "شناسه کاربر معتبر نیست." }

        val resolver = context.contentResolver
        onProgress(12, "بررسی نام، نوع و اندازه فایل")
        val originalName = queryDisplayName(context, uri)
        val mimeType = resolver.getType(uri)
        val expectedSize = resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (index >= 0 && cursor.moveToFirst()) cursor.getLong(index).takeIf { it > 0 } else null
        }
        onProgress(22, "خواندن فایل از دستگاه")
        val bytes = resolver.openInputStream(uri)?.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(64 * 1024)
            var total = 0L
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > MAX_UPLOAD_BYTES) throw FileTooLargeException(MAX_UPLOAD_BYTES)
                output.write(buffer, 0, read)
                if (expectedSize != null) {
                    val readPercent = (total * 100 / expectedSize).toInt().coerceIn(0, 100)
                    onProgress(22 + (readPercent * 18 / 100), "خواندن فایل از دستگاه · $readPercent٪")
                }
            }
            output.toByteArray()
        } ?: throw IllegalStateException("خواندن فایل انتخاب‌شده ممکن نشد.")

        if (bytes.size.toLong() > MAX_UPLOAD_BYTES) throw FileTooLargeException(MAX_UPLOAD_BYTES)
        onProgress(46, "محاسبه اثرانگشت SHA-256")
        val sha256 = MessageDigest.getInstance("SHA-256")
            .digest(bytes)
            .joinToString("") { "%02x".format(it) }
        val objectPath = "$ownerId/${UUID.randomUUID()}"
        val contentType = mimeType?.let { runCatching { ContentType.parse(it) }.getOrNull() }
            ?: ContentType.Application.OctetStream

        onProgress(58, "ارسال فایل به مخزن خصوصی؛ انتظار پاسخ Storage")
        // Storage enforces the same 50,000,000-byte hard limit independently of this client check.
        supabase.storage.from("user-files").upload(objectPath, bytes) {

            this.contentType = contentType
            upsert = false
        }

        onProgress(82, "انتقال Storage کامل شد؛ ثبت مالکیت و مشخصات فایل")
        // Keep the exact original filename (including Persian/Unicode) only as metadata.
        // If metadata creation fails after Storage accepts the object, remove the object
        // so failed uploads do not leave inaccessible orphaned files in the private bucket.
        val insertedAsset = try {
            supabase.postgrest.from("file_assets").insert(
                FileAssetInsert(
                    owner_id = ownerId,
                    object_path = objectPath,
                    original_name = originalName,
                    mime_type = mimeType,
                    byte_size = bytes.size.toLong(),
                    sha256_hex = sha256
                )
            ) {
                select()
            }.decodeList<FileAssetIdRow>().single()
        } catch (exception: Exception) {
            runCatching {
                supabase.storage.from("user-files").delete(objectPath)
            }
            throw exception
        }

        onProgress(96, "فایل و metadata با موفقیت ذخیره شدند")
        return UploadedFile(
            fileAssetId = insertedAsset.id,
            originalName = originalName,
            byteSize = bytes.size.toLong(),
            objectPath = objectPath,
            sha256 = sha256
        )
    }

    suspend fun list(ownerId: String): List<VaultFile> {
        require(ownerId.isNotBlank()) { "شناسه کاربر معتبر نیست." }
        return supabase.postgrest["file_assets"].select {
            filter { eq("owner_id", ownerId) }
        }.decodeList<VaultFile>()
    }

    suspend fun downloadToUri(
        context: Context,
        file: VaultFile,
        destination: Uri,
        onProgress: (Int, String) -> Unit = { _, _ -> }
    ) {
        require(file.bucket_id == "user-files") { "مخزن فایل معتبر نیست." }
        onProgress(28, "دریافت احراز هویت‌شده از مخزن خصوصی")
        val bytes = supabase.storage.from("user-files").downloadAuthenticated(file.object_path)
        onProgress(68, "بررسی حجم و SHA-256 فایل")
        require(verifyFileIntegrity(bytes, file.byte_size, file.sha256_hex)) {
            "سلامت فایل دریافتی تأیید نشد؛ حجم یا اثرانگشت فایل با اطلاعات ثبت‌شده مطابقت ندارد."
        }
        onProgress(88, "سلامت فایل تأیید شد؛ ذخیره روی دستگاه")
        context.contentResolver.openOutputStream(destination, "w")?.use { output ->
            output.write(bytes)
            output.flush()
        } ?: throw IllegalStateException("ذخیره فایل در دستگاه ممکن نشد.")
        onProgress(96, "فایل با موفقیت روی دستگاه ذخیره شد")
    }

    private fun queryDisplayName(context: Context, uri: Uri): String {
        val projection = arrayOf(OpenableColumns.DISPLAY_NAME)
        context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) {
                cursor.getString(index)?.takeIf { it.isNotBlank() }?.let { return it }
            }
        }
        return uri.lastPathSegment?.substringAfterLast('/')?.takeIf { it.isNotBlank() } ?: "file"
    }
}
