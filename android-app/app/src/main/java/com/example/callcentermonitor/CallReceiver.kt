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
        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val stateStr = intent.extras?.getString(TelephonyManager.EXTRA_STATE)
            val number = intent.extras?.getString(TelephonyManager.EXTRA_INCOMING_NUMBER)

            var state = TelephonyManager.CALL_STATE_IDLE
            when (stateStr) {
                TelephonyManager.EXTRA_STATE_IDLE     -> state = TelephonyManager.CALL_STATE_IDLE
                TelephonyManager.EXTRA_STATE_OFFHOOK  -> state = TelephonyManager.CALL_STATE_OFFHOOK
                TelephonyManager.EXTRA_STATE_RINGING  -> state = TelephonyManager.CALL_STATE_RINGING
            }

            onCallStateChanged(context, state, number)
        }
    }

    private fun onCallStateChanged(context: Context, state: Int, number: String?) {
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
                processFinishedCall(context, ringingDuration)

                // Reset timers
                ringStartTime = 0L
                callStartTime = 0L
            }
        }
        lastState = state
    }

    private fun processFinishedCall(context: Context, ringingDuration: Int) {
        Log.d("CallReceiver", "Saving ringingDuration=$ringingDuration to SharedPrefs and triggering worker")
        // Save to SharedPreferences — JobIntentService doesn't reliably propagate Intent extras
        val prefs = context.getSharedPreferences("CallMonitorPrefs", android.content.Context.MODE_PRIVATE)
        prefs.edit().putInt("lastRingingDuration", ringingDuration).apply()

        val workIntent = Intent(context, CallLogWorker::class.java)
        CallLogWorker.enqueueWork(context, workIntent)
    }
}
