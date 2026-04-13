package com.example.callcentermonitor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.callcentermonitor.data.AppDatabase
import kotlinx.coroutines.*

class HeartbeatService : Service() {

    private val serviceJob = Job()
    private val serviceScope = CoroutineScope(Dispatchers.Main + serviceJob)
    private var isServiceRunning = false
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!isServiceRunning) {
            isServiceRunning = true
            
            // Acquire WakeLock
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "CallMonitor:HeartbeatWakeLock")
            wakeLock?.acquire(10*60*1000L /*10 minutes, will re-acquire if loop continues*/)

            startForegroundService()
            startHeartbeatLoop()
        }
        return START_STICKY
    }

    private fun startForegroundService() {
        val channelId = "HeartbeatChannel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Agent Status Tracking",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Call Monitor Active")
            .setContentText("Agent status tracking is running in the background.")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(2002, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(2002, notification)
        }
    }

    private fun startHeartbeatLoop() {
        serviceScope.launch {
            while (isServiceRunning) {
                // Ensure WakeLock is held
                if (wakeLock?.isHeld == false) {
                    wakeLock?.acquire(10*60*1000L)
                }

                withContext(Dispatchers.IO) {
                    try {
                        // Using the ping endpoint as it manages sessions too
                        val success = ApiService.sendHeartbeat(this@HeartbeatService)
                        Log.d("HeartbeatService", "Heartbeat/Ping sent. Success: $success")
                        
                        // If heartbeat succeeded, we have internet! Try to sync pending logs.
                        if (success) {
                            syncPendingLogs()
                        }
                    } catch (e: Exception) {
                        Log.e("HeartbeatService", "Heartbeat error: ${e.message}")
                    }
                }
                delay(30000) // Every 30 seconds for better reliability
            }
        }
    }

    private suspend fun syncPendingLogs() {
        try {
            val database = AppDatabase.getDatabase(this)
            val pendingLogs = database.callLogDao().getAllPendingLogs()
            
            if (pendingLogs.isNotEmpty()) {
                Log.d("HeartbeatService", "Found ${pendingLogs.size} pending logs. Attempting auto-sync.")
                val syncSuccess = ApiService.pushCallLogBatch(this, pendingLogs)
                if (syncSuccess) {
                    Log.d("HeartbeatService", "Auto-sync successful. Marking logs as synced.")
                    pendingLogs.forEach { it.isSynced = true }
                    database.callLogDao().updateLogs(pendingLogs)
                } else {
                    Log.w("HeartbeatService", "Auto-sync failed. Will retry on next heartbeat.")
                }
            }
        } catch (e: Exception) {
            Log.e("HeartbeatService", "Error during auto-sync: ${e.message}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
        serviceJob.cancel()
    }
}
