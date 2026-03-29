package com.example.callcentermonitor

import android.content.Context
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException

object ApiService {

    private val client = OkHttpClient()
    private val JSON = "application/json; charset=utf-8".toMediaType()

    fun pushCallLogBatch(context: Context, logs: List<com.example.callcentermonitor.data.CallLogEntity>): Boolean {
        try {
            val prefs = context.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("serverUrl", "https://call-log-tracker.vercel.app") ?: "https://call-log-tracker.vercel.app"
            val activeToken = prefs.getString("token", "")

            if (serverUrl.isNullOrEmpty()) {
                Log.e("ApiService", "Server URL missing. Cannot push batch.")
                return false
            }

            var allSuccess = true

            // Group logs by the token stored with them when they were created
            val groupedLogs = logs.groupBy { it.agentToken }

            for ((savedToken, logsInGroup) in groupedLogs) {
                // If the log doesn't have a token (e.g. created before this feature), fall back to active token
                val tokenToUse = if (savedToken.isNotEmpty()) savedToken else activeToken

                if (tokenToUse.isNullOrEmpty()) {
                    Log.e("ApiService", "No token available for batch of ${logsInGroup.size} logs. Skipping this group.")
                    allSuccess = false
                    continue
                }

                val jsonArray = org.json.JSONArray()
                for (log in logsInGroup) {
                    val jsonObj = JSONObject()
                    jsonObj.put("phoneNumber", log.phoneNumber)
                    jsonObj.put("type", log.type)
                    jsonObj.put("duration", log.duration)
                    jsonObj.put("ringingDuration", log.ringingDuration)
                    jsonObj.put("timestamp", log.timestamp)
                    jsonObj.put("disconnectedBy", log.disconnectedBy)
                    jsonObj.put("metadata", log.metadata ?: JSONObject.NULL)
                    jsonArray.put(jsonObj)
                }

                val body = jsonArray.toString().toRequestBody(JSON)
                val request = Request.Builder()
                    .url("$serverUrl/api/logs")
                    .header("Authorization", "Bearer $tokenToUse")
                    .post(body)
                    .build()

                Log.d("ApiService", "Attempting to push batch of ${logsInGroup.size} logs to: $serverUrl/api/logs with token starting with ${tokenToUse.take(5)}...")

                val response = client.newCall(request).execute()
                val isSuccess = response.isSuccessful
                if (!isSuccess) {
                    Log.e("ApiService", "Server returned error: ${response.code} ${response.message}")
                    allSuccess = false
                } else {
                    Log.d("ApiService", "Successfully pushed call log batch group to dashboard.")
                }
                response.close()
            }
            
            return allSuccess
        } catch (e: Exception) {
            Log.e("ApiService", "Exception inside pushCallLogBatch: ${e.message}", e)
            return false
        }
    }

    fun sendHeartbeat(context: Context): Boolean {
        try {
            val prefs = context.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("serverUrl", "https://call-log-tracker.vercel.app") ?: "https://call-log-tracker.vercel.app"
            val activeToken = prefs.getString("token", "")

            if (activeToken.isNullOrEmpty()) {
                return false
            }

            val request = okhttp3.Request.Builder()
                .url("$serverUrl/api/agent/ping")
                .header("Authorization", "Bearer $activeToken")
                .post("{}".toRequestBody(JSON))
                .build()

            val response = client.newCall(request).execute()
            val isSuccess = response.isSuccessful
            response.close()
            return isSuccess
        } catch (e: Exception) {
            Log.e("ApiService", "Heartbeat error: ${e.message}")
            return false
        }
    }
}
