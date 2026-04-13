package com.example.callcentermonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log

class CallReceiver : BroadcastReceiver() {

    companion object {
        private var lastState = TelephonyManager.CALL_STATE_IDLE
        private var isIncoming = false
        private var savedNumber: String? = null
        private var ringStartTime: Long = 0L   // epoch ms when phone started ringing
        private var callStartTime: Long = 0L   // epoch ms when call was answered
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "com.example.callcentermonitor.ACTION_ANSWER") {
            Log.d("CallReceiver", "ACTION_ANSWER received from Notification")
            CallManager.answer()
            // Launch CallActivity after answering
            val callIntent = Intent(context, CallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            context.startActivity(callIntent)
            return
        }
        if (intent.action == "com.example.callcentermonitor.ACTION_DECLINE") {
            Log.d("CallReceiver", "ACTION_DECLINE received from Notification")
            CallManager.reject()
            return
        }

        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val extras = intent.extras
            if (extras != null) {
                Log.d("CallReceiver", "--- Intent Extras ---")
                for (key in extras.keySet()) {
                    Log.d("CallReceiver", "$key: ${extras.get(key)}")
                }
            }

            val stateStr = extras?.getString(TelephonyManager.EXTRA_STATE)
            val number = extras?.getString(TelephonyManager.EXTRA_INCOMING_NUMBER)

            var state = TelephonyManager.CALL_STATE_IDLE
            when (stateStr) {
                TelephonyManager.EXTRA_STATE_IDLE     -> state = TelephonyManager.CALL_STATE_IDLE
                TelephonyManager.EXTRA_STATE_OFFHOOK  -> state = TelephonyManager.CALL_STATE_OFFHOOK
                TelephonyManager.EXTRA_STATE_RINGING  -> state = TelephonyManager.CALL_STATE_RINGING
            }

            onCallStateChanged(context, state, number, intent)
        }
    }

    private fun onCallStateChanged(context: Context, state: Int, number: String?, intent: Intent) {
        if (lastState == state) return

        when (state) {
            TelephonyManager.CALL_STATE_RINGING -> {
                isIncoming = true
                savedNumber = number
                ringStartTime = System.currentTimeMillis()
                Log.d("CallReceiver", "Incoming call from $savedNumber — ringing started")
            }
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                if (lastState != TelephonyManager.CALL_STATE_RINGING) {
                    // Outgoing call initiated — start tracking total offhook time
                    isIncoming = false
                    savedNumber = number
                    ringStartTime = 0L // no "ringing" phase broadcast for outgoing
                    callStartTime = System.currentTimeMillis()
                    Log.d("CallReceiver", "Outgoing call to $savedNumber initiated")
                } else {
                    // Incoming call answered — stop the ringing timer
                    callStartTime = System.currentTimeMillis()
                    Log.d("CallReceiver", "Call answered. Ringing lasted ${(callStartTime - ringStartTime) / 1000}s")
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                val ringingDuration: Int = when {
                    lastState == TelephonyManager.CALL_STATE_RINGING -> {
                        // Missed / rejected — ringing stopped without being answered
                        ((System.currentTimeMillis() - ringStartTime) / 1000).toInt()
                    }
                    lastState == TelephonyManager.CALL_STATE_OFFHOOK && isIncoming -> {
                        // Incoming answered — ringing duration = answer time minus ring start
                        if (ringStartTime > 0L && callStartTime > 0L)
                            ((callStartTime - ringStartTime) / 1000).toInt()
                        else 0
                    }
                    lastState == TelephonyManager.CALL_STATE_OFFHOOK && !isIncoming -> {
                        // Outgoing call finished — calculate total offhook duration!
                        // (We will subtract actual talk duration later in the Worker)
                        if (callStartTime > 0L)
                            ((System.currentTimeMillis() - callStartTime) / 1000).toInt()
                        else 0
                    }
                    else -> 0
                }

                Log.d("CallReceiver", "Call ended. Calculated initial Duration=$ringingDuration s")
                processFinishedCall(context, ringingDuration, intent.extras)

                // Reset timers
                ringStartTime = 0L
                callStartTime = 0L
            }
        }
        lastState = state
    }

    private fun processFinishedCall(context: Context, ringingDuration: Int, extras: android.os.Bundle?) {
        Log.d("CallReceiver", "Saving ringingDuration=$ringingDuration and extras to SharedPrefs")
        val prefs = context.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
        
        val extrasBuilder = StringBuilder()
        extras?.let {
            for (key in it.keySet()) {
                extrasBuilder.append("$key: ${it.get(key)}\n")
            }
        }

        prefs.edit()
            .putInt("lastRingingDuration", ringingDuration)
            .putString("lastIntentExtras", extrasBuilder.toString())
            .apply()

        val workRequest = androidx.work.OneTimeWorkRequestBuilder<CallLogWorker>()
            .build()
        
        androidx.work.WorkManager.getInstance(context).enqueueUniqueWork(
            "CallLogCaptureWork",
            androidx.work.ExistingWorkPolicy.REPLACE,
            workRequest
        )
    }
}
