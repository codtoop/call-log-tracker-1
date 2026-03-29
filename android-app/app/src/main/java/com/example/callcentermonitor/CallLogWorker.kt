package com.example.callcentermonitor

import android.content.Context
import android.provider.CallLog
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.ExistingWorkPolicy
import kotlinx.coroutines.delay
import java.lang.StringBuilder

class CallLogWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        Log.d("CallLogWorker", "Work started. Waiting 15 seconds for CallLog to sync...")
        
        val prefs = applicationContext.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
        val ringingDuration = prefs.getInt("lastRingingDuration", 0)
        prefs.edit().remove("lastRingingDuration").apply()
        
        delay(15000)

        return try {
            readLastCallLog(ringingDuration)
            Result.success()
        } catch (e: Exception) {
            Log.e("CallLogWorker", "Error in CallLogWorker: ${e.message}", e)
            Result.failure()
        }
    }

    private fun readLastCallLog(ringingDuration: Int) {
        val targetNumber = inputData.getString("phoneNumber")
        val selection = if (targetNumber != null) "${CallLog.Calls.NUMBER} LIKE ?" else null
        val selectionArgs = if (targetNumber != null) arrayOf("%${targetNumber.takeLast(8)}") else null

        val cursor = applicationContext.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            null, 
            selection, 
            selectionArgs, 
            CallLog.Calls.DATE + " DESC"
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val numberColumn = it.getColumnIndex(CallLog.Calls.NUMBER)
                val typeColumn = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateColumn = it.getColumnIndex(CallLog.Calls.DATE)
                val durationColumn = it.getColumnIndex(CallLog.Calls.DURATION)
                val disconnectCauseColumn = it.getColumnIndex("disconnect_cause")
                val disconnectReasonColumn = it.getColumnIndex("disconnect_reason")
                val shortReasonColumn = it.getColumnIndex("reason")

                val number = it.getString(numberColumn)
                val typeCode = it.getString(typeColumn).toInt()
                val date = it.getLong(dateColumn)
                val duration = it.getString(durationColumn).toInt()
                val disconnectCauseCode = if (disconnectCauseColumn >= 0) it.getInt(disconnectCauseColumn) else -1
                val disconnectReasonCode = if (disconnectReasonColumn >= 0) it.getInt(disconnectReasonColumn) else -1
                val reasonCode = if (shortReasonColumn >= 0) it.getInt(shortReasonColumn) else -1

                var type = "UNKNOWN"
                when (typeCode) {
                    CallLog.Calls.INCOMING_TYPE -> type = "INCOMING"
                    CallLog.Calls.OUTGOING_TYPE -> type = "OUTGOING"
                    CallLog.Calls.MISSED_TYPE -> type = "MISSED"
                    CallLog.Calls.REJECTED_TYPE -> type = "REJECTED"
                }

                var disconnectedBy = "UNKNOWN"
                var metadataBuilder = StringBuilder()
                metadataBuilder.append("--- VERSION: v8_IntentExtras ---\n")

                if (disconnectCauseCode != -1 || disconnectReasonCode != -1 || reasonCode != -1) {
                    val code = when {
                        disconnectCauseCode != -1 -> disconnectCauseCode
                        disconnectReasonCode != -1 -> disconnectReasonCode
                        else -> reasonCode
                    }
                    
                    when (code) {
                        2 -> disconnectedBy = "AGENT" // LOCAL (Agent hung up)
                        3 -> disconnectedBy = "CLIENT" // NORMAL (Remote hung up)
                        4 -> disconnectedBy = "CLIENT" // BUSY
                        5 -> disconnectedBy = if (type == "INCOMING") "AGENT" else "CLIENT" // REJECTED
                    }
                }
                
                // Robust busy/declined logic
                if (disconnectedBy == "UNKNOWN" || disconnectedBy == "AGENT") {
                    if (type == "OUTGOING" && duration == 0) {
                        // On many devices, reason 0, 1, 2, or 4 for an outgoing 0-duration call means CLIENT REJECTED/BUSY
                        // 0 = Declined/Rejected
                        // 1 = Busy
                        // 2 = Client unreachable
                        // 4 = Client Busy
                        if (reasonCode in listOf(0, 1, 2, 4) || disconnectCauseCode in listOf(0, 1, 2, 4)) {
                            disconnectedBy = "CLIENT"
                        } else {
                            disconnectedBy = "AGENT"
                        }
                    }
                }

                metadataBuilder.append("\n--- COLUMN DIAGNOSTIC ---\n")
                for (i in 0 until it.columnCount) {
                    val name = it.getColumnName(i)
                    val value = try { it.getString(i) } catch (e: Exception) { "N/A" }
                    metadataBuilder.append("$name: $value\n")
                }

                val database = com.example.callcentermonitor.data.AppDatabase.getDatabase(applicationContext)
                var finalRingingDuration = ringingDuration
                if (type == "OUTGOING") {
                    finalRingingDuration = ringingDuration - duration
                    if (finalRingingDuration < 0) finalRingingDuration = 0
                }

                val prefsNow = applicationContext.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
                val activeToken = prefsNow.getString("token", "") ?: ""
                val lastIntentExtras = prefsNow.getString("lastIntentExtras", "") ?: ""

                metadataBuilder.append("\n--- INTENT EXTRAS ---\n")
                metadataBuilder.append(lastIntentExtras)
                
                val finalMetadata = metadataBuilder.toString()
                prefsNow.edit().remove("lastIntentExtras").apply()

                val logEntity = com.example.callcentermonitor.data.CallLogEntity(
                    phoneNumber = number,
                    type = type,
                    duration = duration,
                    ringingDuration = finalRingingDuration,
                    timestamp = date,
                    agentToken = activeToken,
                    disconnectedBy = disconnectedBy,
                    metadata = finalMetadata
                )
                database.callLogDao().insert(logEntity)

                val constraints = Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()

                val syncWorkRequest = OneTimeWorkRequestBuilder<SyncWorker>()
                    .setConstraints(constraints)
                    .build()
                WorkManager.getInstance(applicationContext).enqueueUniqueWork(
                    "SyncCallLogsWork",
                    ExistingWorkPolicy.REPLACE,
                    syncWorkRequest
                )
            }
        }
    }
}
