package com.example.callcentermonitor

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.util.Log
import androidx.core.app.JobIntentService

class CallLogWorker : JobIntentService() {

    companion object {
        private const val JOB_ID = 1000

        fun enqueueWork(context: Context, work: Intent) {
            enqueueWork(context, CallLogWorker::class.java, JOB_ID, work)
        }
    }

    override fun onHandleWork(intent: Intent) {
        Log.d("CallLogWorker", "Waiting 5 seconds for CallLog to sync...")
        // Read ringingDuration from SharedPreferences (written by CallReceiver reliably)
        val prefs = getSharedPreferences("CallMonitorPrefs", android.content.Context.MODE_PRIVATE)
        val ringingDuration = prefs.getInt("lastRingingDuration", 0)
        prefs.edit().remove("lastRingingDuration").apply() // clear after reading
        Log.d("CallLogWorker", "Read ringingDuration=$ringingDuration from SharedPrefs")
        
        // Sleep slightly to let the OS write to the DB
        try {
            Thread.sleep(5000)
        } catch (e: InterruptedException) {
            e.printStackTrace()
        }

        readLastCallLog(ringingDuration)
    }

    private fun readLastCallLog(ringingDuration: Int) {
        try {
            val cursor = contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                null, 
                null, 
                null, 
                CallLog.Calls.DATE + " DESC"
            )

            if (cursor != null && cursor.moveToFirst()) {
                val numberColumn = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                val typeColumn = cursor.getColumnIndex(CallLog.Calls.TYPE)
                val dateColumn = cursor.getColumnIndex(CallLog.Calls.DATE)
                val durationColumn = cursor.getColumnIndex(CallLog.Calls.DURATION)

                val number = cursor.getString(numberColumn)
                val typeCode = cursor.getString(typeColumn).toInt()
                val date = cursor.getLong(dateColumn)
                val duration = cursor.getString(durationColumn).toInt()

                var type = "UNKNOWN"
                when (typeCode) {
                    CallLog.Calls.INCOMING_TYPE -> type = "INCOMING"
                    CallLog.Calls.OUTGOING_TYPE -> type = "OUTGOING"
                    CallLog.Calls.MISSED_TYPE -> type = "MISSED"
                    CallLog.Calls.REJECTED_TYPE -> type = "REJECTED"
                }

                Log.d("CallLogWorker", "Found Last Log: $number | $type | $duration sek")

                // Deduplicate at insert time — check if this exact log was already saved recently
                val database = com.example.callcentermonitor.data.AppDatabase.getDatabase(applicationContext)
                val existing = database.callLogDao().findRecentLog(number, type, date)
                if (existing != null) {
                    Log.d("CallLogWorker", "Duplicate detected locally — skipping insert. Existing id=${existing.id}")
                    cursor.close()
                    return
                }

                var finalRingingDuration = ringingDuration
                if (type == "OUTGOING") {
                    // For outgoing, ringingDuration currently holds the total offhook time
                    // Subtract actual talk duration to find out how long we waited for them to pick up
                    finalRingingDuration = ringingDuration - duration
                    if (finalRingingDuration < 0) finalRingingDuration = 0
                    Log.d("CallLogWorker", "Outgoing Math: Total Offhook=$ringingDuration, Talk=$duration -> Ringing=$finalRingingDuration s")
                }

                val prefsNow = applicationContext.getSharedPreferences("CallMonitorPrefs", android.content.Context.MODE_PRIVATE)
                val activeToken = prefsNow.getString("token", "") ?: ""

                val logEntity = com.example.callcentermonitor.data.CallLogEntity(
                    phoneNumber = number,
                    type = type,
                    duration = duration,
                    ringingDuration = finalRingingDuration,
                    timestamp = date,
                    agentToken = activeToken
                )
                database.callLogDao().insert(logEntity)
                Log.d("CallLogWorker", "Saved log locally. Enqueueing SyncWorker.")

                val constraints = androidx.work.Constraints.Builder()
                    .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                    .build()

                val syncWorkRequest = androidx.work.OneTimeWorkRequestBuilder<SyncWorker>()
                    .setConstraints(constraints)
                    .build()
                androidx.work.WorkManager.getInstance(applicationContext).enqueueUniqueWork(
                    "SyncCallLogsWork",
                    androidx.work.ExistingWorkPolicy.REPLACE,
                    syncWorkRequest
                )

                cursor.close()
            }
        } catch (e: SecurityException) {
            Log.e("CallLogWorker", "Permission not granted to read call logs: ${e.message}")
        } catch (e: Exception) {
            Log.e("CallLogWorker", "Error reading log: ${e.message}")
        }
    }
}
