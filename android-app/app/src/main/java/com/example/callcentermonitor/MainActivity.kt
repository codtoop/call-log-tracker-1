package com.example.callcentermonitor

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import android.Manifest
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.callcentermonitor.ui.theme.CallCenterMonitorTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.entries.all { it.value }
        if (granted) {
            Toast.makeText(this, "Permissions Granted. Background monitoring active.", Toast.LENGTH_SHORT).show()
            // Try to show notification now that we have permission
            val prefs = getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
            val username = prefs.getString("username", "") ?: ""
            val isLoggedOut = prefs.getString("token", "").isNullOrEmpty()
            updateAuthNotification(isLoggedOut, username)
        } else {
            Toast.makeText(this, "Permissions Denied! App will not work properly.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        createNotificationChannel()
        checkPermissions()

        setContent {
            CallCenterMonitorTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    SetupScreen(this)
                }
            }
        }
    }

    private fun checkPermissions() {
        val requiredPerms = mutableListOf(
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_PHONE_STATE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requiredPerms.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val allGranted = requiredPerms.all { 
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED 
        }

        if (!allGranted) {
            requestPermissionLauncher.launch(requiredPerms.toTypedArray())
        } else {
            // If permissions are already granted, immediately try to show the notification
            val prefs = getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
            val username = prefs.getString("username", "") ?: ""
            val isLoggedOut = prefs.getString("token", "").isNullOrEmpty()
            updateAuthNotification(isLoggedOut, username)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Auth Status"
            val descriptionText = "Shows whether the agent is logged in or out"
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel("AuthStatusChannel", name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun updateAuthNotification(isLoggedOut: Boolean, username: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return
        }

        val notificationManager: NotificationManager =
            getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent: PendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)

        val builder = NotificationCompat.Builder(this, "AuthStatusChannel")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true) // Pinned notification
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)

        if (isLoggedOut) {
            builder.setContentTitle("Call Monitor: Logged OUT")
                .setContentText("You are not tracking calls. Tap to log in.")
                .setColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
        } else {
            builder.setContentTitle("Call Monitor: Tracking Active")
                .setContentText("Logged in as $username. Tap to open app.")
                .setColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
        }

        notificationManager.notify(1001, builder.build())
    }
}

@Composable
fun SetupScreen(context: MainActivity) {
    val prefs = context.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
    
    val serverUrl = "https://call-log-tracker.vercel.app"
    var username by remember { mutableStateOf(prefs.getString("username", "") ?: "") }
    var password by remember { mutableStateOf("") }
    var isLoggedOut by remember { mutableStateOf(prefs.getString("token", "").isNullOrEmpty()) }
    var isLoading by remember { mutableStateOf(false) }
    var passwordVisible by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    val passwordFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            val database = com.example.callcentermonitor.data.AppDatabase.getDatabase(context)
            database.callLogDao().deleteLogsByNumber("0779199496")
        }
    }

    val performLogin = {
        if (!isLoading && serverUrl.isNotEmpty() && username.isNotEmpty() && password.isNotEmpty()) {
            isLoading = true
            coroutineScope.launch(Dispatchers.IO) {
                try {
                    val client = OkHttpClient()
                    val JSON = "application/json; charset=utf-8".toMediaType()
                    val jsonObj = JSONObject()
                    jsonObj.put("username", username)
                    jsonObj.put("password", password)

                    val body = jsonObj.toString().toRequestBody(JSON)
                    val request = Request.Builder()
                        .url("$serverUrl/api/auth/login")
                        .post(body)
                        .build()

                    val response = client.newCall(request).execute()
                    val resBody = response.body?.string()

                    withContext(Dispatchers.Main) {
                        isLoading = false
                        if (response.isSuccessful && resBody != null) {
                            val data = JSONObject(resBody)
                            val token = data.getString("token")
                            prefs.edit()
                                .putString("serverUrl", serverUrl)
                                .putString("username", username)
                                .putString("token", token)
                                .apply()
                            isLoggedOut = false
                            Toast.makeText(context, "Login Successful!", Toast.LENGTH_SHORT).show()
                        } else {
                            Toast.makeText(context, "Login Failed. Check credentials/URL.", Toast.LENGTH_LONG).show()
                        }
                    }

                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        isLoading = false
                        Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    // Update notification on first render and whenever isLoggedOut changes
    LaunchedEffect(isLoggedOut, username) {
        context.updateAuthNotification(isLoggedOut, username)
    }

    // Ping server every 60 seconds while logged in to maintain 'Online' status
    LaunchedEffect(isLoggedOut) {
        if (!isLoggedOut) {
            while (true) {
                val currentToken = prefs.getString("token", "") ?: ""
                val currentServerUrl = prefs.getString("serverUrl", "") ?: "https://call-log-tracker.vercel.app"
                if (currentToken.isNotEmpty()) {
                    withContext(Dispatchers.IO) {
                        try {
                            val client = OkHttpClient()
                            val jsonMediaType = "application/json; charset=utf-8".toMediaType()
                            val body = "{}".toRequestBody(jsonMediaType)
                            val request = Request.Builder()
                                .url("$currentServerUrl/api/agent/ping")
                                .header("Authorization", "Bearer $currentToken")
                                .post(body)
                                .build()
                            client.newCall(request).execute().use { response -> 
                                // response consumed and auto-closed by 'use' block
                            }
                        } catch (e: Exception) {
                            // ignore connectivity issues for ping
                        }
                    }
                }
                delay(60_000)
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Call Center Monitor Setup",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Agent Username") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { passwordFocusRequester.requestFocus() }),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp)
        )

        if (isLoggedOut) {
            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Password") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { performLogin() }),
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    TextButton(onClick = { passwordVisible = !passwordVisible }) {
                        Text(if (passwordVisible) "HIDE" else "SHOW")
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp)
                    .focusRequester(passwordFocusRequester)
            )

            Button(
                onClick = { performLogin() },
                modifier = Modifier.fillMaxWidth(),
                enabled = !isLoading && serverUrl.isNotEmpty() && username.isNotEmpty() && password.isNotEmpty()
            ) {
                Text(if (isLoading) "Logging in..." else "Save & Login")
            }
        } else {
            DashboardScreen(context, prefs)
        }
    }
}

@Composable
fun DashboardScreen(context: MainActivity, prefs: android.content.SharedPreferences) {
    var selectedTabIndex by remember { mutableStateOf(0) }
    val tabs = listOf("Pending", "Synced")
    
    var limit by remember { mutableStateOf(10) }
    var page by remember { mutableStateOf(1) }
    val offset = (page - 1) * limit
    val database = com.example.callcentermonitor.data.AppDatabase.getDatabase(context)

    LaunchedEffect(selectedTabIndex) {
        page = 1
    }
    
    val pendingLogs by database.callLogDao().getPendingLogsFlow(limit, offset).collectAsState(initial = emptyList())
    val syncedLogs by database.callLogDao().getSyncedLogsFlow(limit, offset).collectAsState(initial = emptyList())

    val pendingCount by database.callLogDao().getPendingLogsCountFlow().collectAsState(initial = 0)
    val syncedCount by database.callLogDao().getSyncedLogsCountFlow().collectAsState(initial = 0)

    val currentTotal = if (selectedTabIndex == 0) pendingCount else syncedCount
    val totalPages = maxOf(1, (currentTotal + limit - 1) / limit)

    Column(modifier = Modifier.fillMaxSize()) {
        val coroutineScope = rememberCoroutineScope()

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
        ) {
            Text(
                "Logged in as: ${prefs.getString("username", "")}",
                style = MaterialTheme.typography.titleMedium
            )
            Button(
                onClick = {
                    coroutineScope.launch(Dispatchers.IO) {
                        // Notify the server that the agent is logging out
                        try {
                            val token = prefs.getString("token", "") ?: ""
                            val serverUrl = prefs.getString("serverUrl", "") ?: "https://call-log-tracker.vercel.app"
                            if (token.isNotEmpty()) {
                                val client = OkHttpClient()
                                val jsonMediaType = "application/json; charset=utf-8".toMediaType()
                                val body = "{}".toRequestBody(jsonMediaType)
                                val request = Request.Builder()
                                    .url("$serverUrl/api/agent/logout")
                                    .header("Authorization", "Bearer $token")
                                    .post(body)
                                    .build()
                                client.newCall(request).execute().close()
                            }
                        } catch (e: Exception) {
                            // Proceed with local logout even if server call fails
                        }
                        withContext(Dispatchers.Main) {
                            prefs.edit().remove("token").apply()
                            (context as? MainActivity)?.updateAuthNotification(true, "")
                            (context as? MainActivity)?.recreate()
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Text("Logout")
            }
        }

        TabRow(selectedTabIndex = selectedTabIndex) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTabIndex == index,
                    onClick = { selectedTabIndex = index },
                    text = { Text(title) }
                )
            }
        }

        // Pagination Controls
        var expandedLimit by remember { mutableStateOf(false) }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
        ) {
            Box {
                OutlinedButton(onClick = { expandedLimit = true }) {
                    Text("Show: $limit")
                }
                DropdownMenu(
                    expanded = expandedLimit,
                    onDismissRequest = { expandedLimit = false }
                ) {
                    listOf(10, 25, 50).forEach { choice ->
                        DropdownMenuItem(
                            text = { Text("$choice items") },
                            onClick = {
                                limit = choice
                                page = 1
                                expandedLimit = false
                            }
                        )
                    }
                }
            }
            
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                IconButton(
                    onClick = { if (page > 1) page-- },
                    enabled = page > 1
                ) {
                    Text("<", style = MaterialTheme.typography.titleLarge)
                }
                Text("Page $page of $totalPages")
                IconButton(
                    onClick = { if (page < totalPages) page++ },
                    enabled = page < totalPages
                ) {
                    Text(">", style = MaterialTheme.typography.titleLarge)
                }
            }
        }

        Box(modifier = Modifier.weight(1f).fillMaxSize()) {
            if (selectedTabIndex == 0) {
                LogList(logs = pendingLogs, isPending = true)
            } else {
                LogList(logs = syncedLogs, isPending = false)
            }
            
            if (selectedTabIndex == 0) {
                ExtendedFloatingActionButton(
                    onClick = {
                        val constraints = androidx.work.Constraints.Builder()
                            .setRequiredNetworkType(androidx.work.NetworkType.CONNECTED)
                            .build()

                        val syncWorkRequest = androidx.work.OneTimeWorkRequestBuilder<SyncWorker>()
                            .setConstraints(constraints)
                            .build()

                        androidx.work.WorkManager.getInstance(context).enqueueUniqueWork(
                            "SyncCallLogsWork_Manual",
                            androidx.work.ExistingWorkPolicy.REPLACE,
                            syncWorkRequest
                        )
                        Toast.makeText(context, "Manual sync triggered", Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier
                        .padding(16.dp)
                        .align(androidx.compose.ui.Alignment.BottomEnd)
                ) {
                    Text("Manual Sync")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LogList(logs: List<com.example.callcentermonitor.data.CallLogEntity>, isPending: Boolean) {
    if (logs.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) {
            Text(if (isPending) "No pending calls." else "No synced calls.")
        }
    } else {
        val context = androidx.compose.ui.platform.LocalContext.current
        val coroutineScope = rememberCoroutineScope()
        val database = com.example.callcentermonitor.data.AppDatabase.getDatabase(context)

        androidx.compose.foundation.lazy.LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(logs.size, key = { index -> logs[index].id }) { index ->
                val log = logs[index]

                if (isPending) {
                    val dismissState = rememberSwipeToDismissBoxState(
                        confirmValueChange = { dismissValue ->
                            if (dismissValue == SwipeToDismissBoxValue.EndToStart) {
                                coroutineScope.launch(Dispatchers.IO) {
                                    val success = ApiService.pushCallLogBatch(context, listOf(log))
                                    if (success) {
                                        val syncedLog = log.copy(isSynced = true)
                                        database.callLogDao().updateLogs(listOf(syncedLog))
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Call synced successfully!", Toast.LENGTH_SHORT).show()
                                        }
                                    } else {
                                        withContext(Dispatchers.Main) {
                                            Toast.makeText(context, "Failed to sync call.", Toast.LENGTH_SHORT).show()
                                        }
                                    }
                                }
                            }
                            false // Always return false so it snaps back. DB Flow will handle actual removal on success.
                        }
                    )

                    SwipeToDismissBox(
                        state = dismissState,
                        enableDismissFromStartToEnd = false,
                        backgroundContent = {
                            val color = if (dismissState.dismissDirection == SwipeToDismissBoxValue.EndToStart) 
                                MaterialTheme.colorScheme.primaryContainer 
                            else androidx.compose.ui.graphics.Color.Transparent
                            
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(color)
                                    .padding(horizontal = 20.dp),
                                contentAlignment = androidx.compose.ui.Alignment.CenterEnd
                            ) {
                                Text("Sync Up", color = MaterialTheme.colorScheme.onPrimaryContainer)
                            }
                        }
                    ) {
                        LogCard(log)
                    }
                } else {
                    LogCard(log)
                }
            }
        }
    }
}

@Composable
fun LogCard(log: com.example.callcentermonitor.data.CallLogEntity) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("Number: ${log.phoneNumber}", style = MaterialTheme.typography.titleMedium)
            Text("Type: ${log.type}")
            Text("Duration: ${log.duration}s")
        }
    }
}