package com.kaveh.avenger.ui.progress

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import kotlinx.coroutines.delay

@Composable
fun OperationProgressHost(modifier: Modifier = Modifier) {
    val progress by OperationProgressController.state.collectAsState()
    LaunchedEffect(progress?.id, progress?.status) {
        val current = progress ?: return@LaunchedEffect
        when (current.status) {
            OperationStatus.RUNNING -> Unit
            OperationStatus.SUCCESS -> {
                delay(1_500)
                OperationProgressController.dismiss(current.id)
            }
            OperationStatus.FAILURE -> {
                delay(5_000)
                OperationProgressController.dismiss(current.id)
            }
        }
    }
    val current = progress ?: return
    val statusColor = when (current.status) {
        OperationStatus.RUNNING -> MaterialTheme.colorScheme.primary
        OperationStatus.SUCCESS -> Color(0xFF2E9D70)
        OperationStatus.FAILURE -> MaterialTheme.colorScheme.error
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 10.dp)
            .zIndex(30f),
        contentAlignment = Alignment.TopCenter
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 10.dp)
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 13.dp),
                verticalArrangement = Arrangement.spacedBy(9.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (current.status == OperationStatus.RUNNING) {
                        CircularProgressIndicator(
                            modifier = Modifier.padding(2.dp),
                            color = statusColor,
                            strokeWidth = 2.dp
                        )
                    }
                    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(current.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(current.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(
                        if (current.status == OperationStatus.FAILURE) "خطا" else "${current.percent.toPersianDigits()}٪",
                        style = MaterialTheme.typography.titleSmall,
                        color = statusColor,
                        fontWeight = FontWeight.ExtraBold
                    )
                }
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(99.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(current.percent / 100f)
                            .height(6.dp)
                            .clip(RoundedCornerShape(99.dp))
                            .background(statusColor)
                    )
                }
            }
        }
    }
}

private fun Int.toPersianDigits(): String =
    toString().map { digit -> if (digit in '0'..'9') ('۰'.code + (digit - '0')).toChar() else digit }.joinToString("")
