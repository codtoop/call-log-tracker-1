package com.example.callcentermonitor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.util.Log

class CallCenterInCallService : InCallService() {
    
    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "incoming_call_channel"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // Channel for incoming calls (HIGH priority)
            val incomingChannel = NotificationChannel(
                CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming calls"
                enableLights(true)
                lightColor = android.graphics.Color.RED
                enableVibration(true)
            }
            
            // Channel for ongoing calls (LOW priority to not make noise during call)
            val ongoingChannel = NotificationChannel(
                "ongoing_call_channel",
                "Ongoing Calls",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Status of active calls"
            }
            
            notificationManager.createNotificationChannel(incomingChannel)
            notificationManager.createNotificationChannel(ongoingChannel)
        }
    }

    override fun onCallAudioStateChanged(audioState: CallAudioState?) {
        super.onCallAudioStateChanged(audioState)
        Log.d("InCallService", "onCallAudioStateChanged: muted=${audioState?.isMuted}, route=${audioState?.route}")
        CallManager.updateAudioState(audioState)
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        Log.d("InCallService", "onCallAdded: $call, state: ${call.state}")
        
        CallManager.inCallService = this
        CallManager.updateCall(call)
        CallManager.updateAudioState(callAudioState)
        call.registerCallback(callCallback)

        // Promotion to foreground immediately
        if (call.state == Call.STATE_RINGING) {
            showIncomingCallNotification(call)
        } else {
            showOngoingCallNotification(call)
            val intent = Intent(this, CallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            startActivity(intent)
        }
    }

    private fun showIncomingCallNotification(call: Call) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Ensure the screen wakes up immediately to display the notification
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            @Suppress("DEPRECATION")
            val wakeLock = pm.newWakeLock(
                android.os.PowerManager.FULL_WAKE_LOCK or android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or android.os.PowerManager.ON_AFTER_RELEASE,
                "CallCenterMonitor::IncomingCall"
            )
            wakeLock.acquire(5000)
        } catch (e: Exception) {
            Log.e("InCallService", "Failed to wake up screen", e)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming calls"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val fullScreenIntent = Intent(this, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val fullScreenPendingIntent = PendingIntent.getActivity(
            this, 0, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val answerIntent = Intent(this, CallReceiver::class.java).apply {
            action = "com.example.callcentermonitor.ACTION_ANSWER"
        }
        val answerPendingIntent = PendingIntent.getBroadcast(
            this, 1, answerIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val declineIntent = Intent(this, CallReceiver::class.java).apply {
            action = "com.example.callcentermonitor.ACTION_DECLINE"
        }
        val declinePendingIntent = PendingIntent.getBroadcast(
            this, 2, declineIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val rawNumber = call.details?.handle?.schemeSpecificPart ?: "Unknown"

        val builder = Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_phone_call)
            .setContentTitle("Incoming Call")
            .setContentText(rawNumber)
            .setPriority(Notification.PRIORITY_MAX)
            .setCategory(Notification.CATEGORY_CALL)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setOngoing(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val caller = android.app.Person.Builder().setName(rawNumber).setImportant(true).build()
            builder.setStyle(Notification.CallStyle.forIncomingCall(caller, declinePendingIntent, answerPendingIntent))
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val answerTitle = android.text.SpannableString("Answer")
            answerTitle.setSpan(
                android.text.style.ForegroundColorSpan(android.graphics.Color.parseColor("#4CAF50")),
                0, answerTitle.length, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )

            val declineTitle = android.text.SpannableString("Decline")
            declineTitle.setSpan(
                android.text.style.ForegroundColorSpan(android.graphics.Color.parseColor("#F44336")),
                0, declineTitle.length, android.text.Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
            )

            val answerAction = Notification.Action.Builder(null, answerTitle, answerPendingIntent).build()
            val declineAction = Notification.Action.Builder(null, declineTitle, declinePendingIntent).build()
            
            builder.addAction(answerAction)
            builder.addAction(declineAction)
        }

        val notification = builder.build()
        notification.flags = notification.flags or Notification.FLAG_ONGOING_EVENT or Notification.FLAG_NO_CLEAR

        // Immediately promote to foreground for RINGING too to ensure it's not dismissed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun showOngoingCallNotification(call: Call) {
        val ongoingChannelId = "ongoing_call_channel"
        val rawNumber = call.details?.handle?.schemeSpecificPart ?: "Unknown"
        val contactName = resolveContactName(this, rawNumber)
        val titleText = contactName ?: rawNumber

        val contentIntent = Intent(this, CallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this, 0, contentIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val hangupIntent = Intent(this, CallReceiver::class.java).apply {
            action = "com.example.callcentermonitor.ACTION_DECLINE"
        }
        val hangupPendingIntent = PendingIntent.getBroadcast(
            this, 2, hangupIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val caller = android.app.Person.Builder()
                .setName(titleText)
                .setImportant(true)
                .build()
            
            Notification.Builder(this, ongoingChannelId)
                .setSmallIcon(android.R.drawable.stat_sys_phone_call)
                .setStyle(Notification.CallStyle.forOngoingCall(caller, hangupPendingIntent))
                .setFullScreenIntent(contentPendingIntent, false) // Not full screen, just content intent
        } else {
            Notification.Builder(this, ongoingChannelId)
                .setSmallIcon(android.R.drawable.stat_sys_phone_call)
                .setContentTitle("Active Call")
                .setContentText(titleText)
                .setOngoing(true)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", hangupPendingIntent)
        }

        builder.setContentIntent(contentPendingIntent)
            .setCategory(Notification.CATEGORY_CALL)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setUsesChronometer(true)

        val notification = builder.build()
        notification.flags = notification.flags or Notification.FLAG_ONGOING_EVENT or Notification.FLAG_NO_CLEAR

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun resolveContactName(context: Context, phoneNumber: String?): String? {
        if (phoneNumber.isNullOrEmpty()) return null
        if (androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_CONTACTS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return null
        try {
            val uri = android.net.Uri.withAppendedPath(android.provider.ContactsContract.PhoneLookup.CONTENT_FILTER_URI, android.net.Uri.encode(phoneNumber))
            val cursor = context.contentResolver.query(uri, arrayOf(android.provider.ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
            cursor?.use {
                if (it.moveToFirst()) return it.getString(0)
            }
        } catch (e: Exception) { }
        return null
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        Log.d("InCallService", "onCallRemoved: $call")
        call.unregisterCallback(callCallback)
        
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        notificationManager.cancel(NOTIFICATION_ID)

        CallManager.updateCall(null)
        if (CallManager.inCallService == this) {
            CallManager.inCallService = null
        }
    }

    private val callCallback = object : Call.Callback() {
        override fun onStateChanged(call: Call, state: Int) {
            Log.d("InCallService", "Call state changed to: $state")
            CallManager.updateCall(call)
            
            if (state == Call.STATE_DISCONNECTED) {
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                notificationManager.cancel(NOTIFICATION_ID)

                val details = call.details
                val disconnectCause = details.disconnectCause
                Log.d("InCallService", "Call disconnected with cause: ${disconnectCause.code} / ${disconnectCause.reason}")
                
                // Determine direction (API 25+ has it in details)
                val direction = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
                    details.callDirection
                } else {
                    // Fallback for API 24: if it was ringing, it was incoming.
                    // However, at disconnection time, the state is DISCONNECTED. 
                    // We should have captured this in onCallAdded.
                    // For now, we'll check if the number was "Unknown" vs a dialed number if possible,
                    // but the best way is to check the state in onCallAdded.
                    // Since we are inside the callback, we can assume the direction was already determined.
                    -1 // Unknown fallback
                }

                val isOutgoing = direction == android.telecom.Call.Details.DIRECTION_OUTGOING || 
                                 (direction == -1 && call.state != android.telecom.Call.STATE_RINGING)

                var byWhom = when (disconnectCause.code) {
                    android.telecom.DisconnectCause.LOCAL -> "AGENT"
                    android.telecom.DisconnectCause.REMOTE -> "CLIENT"
                    android.telecom.DisconnectCause.REJECTED -> if (isOutgoing) "CLIENT" else "AGENT"
                    android.telecom.DisconnectCause.MISSED -> "CLIENT"
                    android.telecom.DisconnectCause.BUSY -> "CLIENT"
                    android.telecom.DisconnectCause.CANCELED -> "AGENT"
                    else -> "UNKNOWN"
                }

                // If the agent explicitly clicked hangup/decline, trust our app state 100%
                if (CallManager.explicitAgentHangup) {
                    byWhom = "AGENT"
                } else if (byWhom == "UNKNOWN" || disconnectCause.code == android.telecom.DisconnectCause.OTHER || disconnectCause.code == android.telecom.DisconnectCause.ERROR) {
                    // If the framework gives us an unknown or generic cause, and the agent did NOT hang up explicitly,
                    // we deduce that the remote user (or network) dropped the call.
                    byWhom = "CLIENT"
                }

                Log.d("InCallService", "Attributed hangup to: $byWhom (isOutgoing=$isOutgoing, code=${disconnectCause.code}, explicitAgent=${CallManager.explicitAgentHangup})")
                val prefs = applicationContext.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
                prefs.edit().putString("lastPreciseDisconnectBy", byWhom).apply()
            } else if (state == Call.STATE_ACTIVE) {
                 showOngoingCallNotification(call)
            }
        }
    }
}
