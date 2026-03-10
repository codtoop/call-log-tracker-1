package com.example.callcentermonitor

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.example.callcentermonitor.data.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val database = AppDatabase.getDatabase(applicationContext)
        val pendingLogs = database.callLogDao().getAllPendingLogs()

        if (pendingLogs.isEmpty()) {
            return@withContext Result.success()
        }

        try {
            val success = ApiService.pushCallLogBatch(applicationContext, pendingLogs)
            if (success) {
                pendingLogs.forEach { it.isSynced = true }
                database.callLogDao().updateLogs(pendingLogs)
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e("SyncWorker", "Error syncing logs: ${e.message}")
            Result.retry()
        }
    }
}
