package com.example.callcentermonitor

import android.content.Context
import android.provider.CallLog
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Calendar

class DailySyncWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            Log.d("DailySyncWorker", "Running daily missing logs sync")
            
            // Get logs from the last 24 hours
            val calendar = Calendar.getInstance()
            calendar.add(Calendar.DAY_OF_YEAR, -1)
            val startTime = calendar.timeInMillis

            val selection = "${CallLog.Calls.DATE} >= ?"
            val selectionArgs = arrayOf(startTime.toString())

            val cursor = applicationContext.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                null,
                selection,
                selectionArgs,
                CallLog.Calls.DATE + " DESC"
            )

            val logsToSync = mutableListOf<com.example.callcentermonitor.data.CallLogEntity>()

            cursor?.use {
                val numCol = it.getColumnIndex(CallLog.Calls.NUMBER)
                val typeCol = it.getColumnIndex(CallLog.Calls.TYPE)
                val dateCol = it.getColumnIndex(CallLog.Calls.DATE)
                val durCol = it.getColumnIndex(CallLog.Calls.DURATION)
                
                while (it.moveToNext()) {
                    val number = it.getString(numCol) ?: "Unknown"
                    val typeInt = it.getInt(typeCol)
                    val date = it.getLong(dateCol)
                    val duration = it.getInt(durCol)

                    val typeStr = when (typeInt) {
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                        else -> "UNKNOWN"
                    }

                    logsToSync.add(
                        com.example.callcentermonitor.data.CallLogEntity(
                            phoneNumber = number,
                            type = typeStr,
                            duration = duration,
                            ringingDuration = 0,
                            timestamp = date,
                            disconnectedBy = "UNKNOWN",
                            isSynced = false,
                            agentToken = ""
                        )
                    )
                }
            }

            if (logsToSync.isEmpty()) {
                Log.d("DailySyncWorker", "No calls to sync from the past 24 hours")
                return@withContext Result.success()
            }

            Log.d("DailySyncWorker", "Found ${logsToSync.size} logs. Pushing to daily-sync endpoint...")
            val success = ApiService.pushDailySyncBatch(applicationContext, logsToSync)
            
            if (success) {
                Log.d("DailySyncWorker", "Successfully synced missing logs.")
                Result.success()
            } else {
                Log.w("DailySyncWorker", "Failed to sync missing logs. Retrying...")
                Result.retry()
            }

        } catch (e: Exception) {
            Log.e("DailySyncWorker", "Error during daily sync: ${e.message}", e)
            Result.retry()
        }
    }
}
