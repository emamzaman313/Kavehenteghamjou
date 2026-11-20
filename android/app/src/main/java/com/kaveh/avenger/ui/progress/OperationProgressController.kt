package com.kaveh.avenger.ui.progress

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.atomic.AtomicLong

enum class OperationStatus { RUNNING, SUCCESS, FAILURE }

data class OperationProgressState(
    val id: Long,
    val title: String,
    val detail: String,
    val percent: Int,
    val status: OperationStatus
)

class OperationProgressReporter internal constructor(private val operationId: Long) {
    fun advance(percent: Int, detail: String) {
        OperationProgressController.advance(operationId, percent, detail)
    }
}

object OperationProgressController {
    private val sequence = AtomicLong(0)
    private val mutableState = MutableStateFlow<OperationProgressState?>(null)
    val state = mutableState.asStateFlow()

    private fun begin(title: String): Long {
        val id = sequence.incrementAndGet()
        mutableState.value = OperationProgressState(
            id = id,
            title = title,
            detail = "آماده‌سازی عملیات",
            percent = 6,
            status = OperationStatus.RUNNING
        )
        return id
    }

    internal fun advance(id: Long, percent: Int, detail: String) {
        val current = mutableState.value ?: return
        if (current.id != id || current.status != OperationStatus.RUNNING) return
        mutableState.value = current.copy(
            percent = maxOf(current.percent, percent.coerceIn(6, 95)),
            detail = detail
        )
    }

    private fun complete(id: Long) {
        val current = mutableState.value ?: return
        if (current.id != id) return
        mutableState.value = current.copy(percent = 100, detail = "با موفقیت تکمیل شد", status = OperationStatus.SUCCESS)
    }

    private fun fail(id: Long) {
        val current = mutableState.value ?: return
        if (current.id != id) return
        mutableState.value = current.copy(detail = "عملیات ناموفق بود؛ جزئیات خطا در همان بخش نمایش داده می‌شود", status = OperationStatus.FAILURE)
    }

    fun dismiss(id: Long) {
        if (mutableState.value?.id == id) mutableState.value = null
    }

    suspend fun <T> run(
        title: String,
        action: suspend (OperationProgressReporter) -> T
    ): T {
        val id = begin(title)
        return try {
            val result = action(OperationProgressReporter(id))
            complete(id)
            result
        } catch (error: Throwable) {
            fail(id)
            throw error
        }
    }
}
