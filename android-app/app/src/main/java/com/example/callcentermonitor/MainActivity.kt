package com.example.callcentermonitor

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.CallLog
import android.provider.ContactsContract
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.example.callcentermonitor.ui.theme.CallCenterMonitorTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// Explicit imports for local classes and resources
import com.example.callcentermonitor.R
import com.example.callcentermonitor.SyncWorker
import com.example.callcentermonitor.HeartbeatService
import com.example.callcentermonitor.data.AppDatabase
import com.example.callcentermonitor.data.CallLogEntity

class MainActivity : ComponentActivity() {

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val granted = permissions.entries.all { it.value }
        if (granted) {
            val prefs = getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
            val username = prefs.getString("username", "") ?: ""
            val isLoggedOut = prefs.getString("token", "").isNullOrEmpty()
            updateAuthNotification(isLoggedOut, username)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
        checkPermissions()
        requestDefaultDialerRole()
        scheduleDailySync(this)

        setContent {
            com.example.callcentermonitor.ui.theme.CallCenterMonitorTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    MainScreen(this)
                }
            }
        }
    }

    private fun requestDefaultDialerRole() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(android.app.role.RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(android.app.role.RoleManager.ROLE_DIALER)) {
                if (!roleManager.isRoleHeld(android.app.role.RoleManager.ROLE_DIALER)) {
                    val intent = roleManager.createRequestRoleIntent(android.app.role.RoleManager.ROLE_DIALER)
                    startActivityForResult(intent, 100)
                }
            }
        }
    }

    private fun checkPermissions() {
        val requiredPerms = mutableListOf(
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requiredPerms.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val allGranted = requiredPerms.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }
        if (!allGranted) {
            requestPermissionLauncher.launch(requiredPerms.toTypedArray())
        } else {
            val prefs = getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
            val username = prefs.getString("username", "") ?: ""
            val isLoggedOut = prefs.getString("token", "").isNullOrEmpty()
            updateAuthNotification(isLoggedOut, username)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("AuthStatusChannel", "Auth Status", NotificationManager.IMPORTANCE_LOW)
            val notificationManager: NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun updateAuthNotification(isLoggedOut: Boolean, username: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val intent = Intent(this, MainActivity::class.java).apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK }
        val pendingIntent: PendingIntent = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        val builder = NotificationCompat.Builder(this, "AuthStatusChannel")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
        if (isLoggedOut) {
            builder.setContentTitle("Call Monitor: Logged OUT").setContentText("Tap to log in.").setColor(0xFFE53935.toInt())
        } else {
            builder.setContentTitle("Call Monitor: Tracking Active").setContentText("Agent: $username").setColor(0xFF43A047.toInt())
        }
        val notificationManager: NotificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(1001, builder.build())
    }

    fun canUseFullScreenIntent(): Boolean {
        if (Build.VERSION.SDK_INT >= 34) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            return notificationManager.canUseFullScreenIntent()
        }
        return true
    }

    fun openFullScreenIntentSettings() {
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                val intent = Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT")
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            } catch (e: Exception) {
                val intent = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                intent.data = Uri.parse("package:$packageName")
                startActivity(intent)
            }
        }
    }

    private fun scheduleDailySync(context: Context) {
        val currentDate = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT+1"))
        val dueDate = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("GMT+1"))
        dueDate.set(java.util.Calendar.HOUR_OF_DAY, 0)
        dueDate.set(java.util.Calendar.MINUTE, 0)
        dueDate.set(java.util.Calendar.SECOND, 0)
        
        if (dueDate.before(currentDate)) {
            dueDate.add(java.util.Calendar.HOUR_OF_DAY, 24)
        }
        val timeDiff = dueDate.timeInMillis - currentDate.timeInMillis
        
        val syncRequest = androidx.work.PeriodicWorkRequestBuilder<com.example.callcentermonitor.DailySyncWorker>(
            24, java.util.concurrent.TimeUnit.HOURS
        )
            .setInitialDelay(timeDiff, java.util.concurrent.TimeUnit.MILLISECONDS)
            .build()
            
        androidx.work.WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "DailyMissingLogsSync",
            androidx.work.ExistingPeriodicWorkPolicy.UPDATE,
            syncRequest
        )
    }
}

data class TabItem(val title: String, val icon: ImageVector)
data class CallEntry(val name: String?, val number: String, val type: Int, val date: Long)

@Composable
fun MainScreen(context: MainActivity) {
    var selectedTabIndex by remember { mutableStateOf(1) } // Default to Keypad
    val tabs = listOf(
        TabItem("Recents", Icons.Default.History),
        TabItem("Keypad", Icons.Default.Dialpad),
        TabItem("Sync", Icons.Default.CloudSync),
        TabItem("Settings", Icons.Default.Settings)
    )
    val canUseFSI = remember { mutableStateOf(context.canUseFullScreenIntent()) }
    
    // Refresh permission status when activity becomes active
    DisposableEffect(Unit) {
        val observer = androidx.lifecycle.LifecycleEventObserver { _, event ->
            if (event == androidx.lifecycle.Lifecycle.Event.ON_RESUME) {
                canUseFSI.value = context.canUseFullScreenIntent()
            }
        }
        context.lifecycle.addObserver(observer)
        onDispose { context.lifecycle.removeObserver(observer) }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 8.dp) {
                tabs.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = selectedTabIndex == index,
                        onClick = { selectedTabIndex = index },
                        icon = { Icon(tab.icon, contentDescription = tab.title) },
                        label = { Text(tab.title) }
                    )
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            Column {
                if (!canUseFSI.value) {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Info, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Full Screen Permission Missing", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
                                Text("The app cannot wake the screen for incoming calls on Android 15. Please enable it in settings.", style = MaterialTheme.typography.bodySmall)
                            }
                            TextButton(onClick = { context.openFullScreenIntentSettings() }) {
                                Text("Fix")
                            }
                        }
                    }
                }
                Box(modifier = Modifier.weight(1f)) {
                    when (selectedTabIndex) {
                        0 -> HistoryScreen(context)
                        1 -> KeypadScreen(context)
                        2 -> SyncScreen(context)
                        3 -> SettingsScreen(context)
                    }
                }
            }
        }
    }
}

private fun launchSms(context: Context, phoneNumber: String) {
    try {
        val intent = Intent(Intent.ACTION_SENDTO).apply {
            data = Uri.parse("smsto:$phoneNumber")
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        Toast.makeText(context, "No messaging app found", Toast.LENGTH_SHORT).show()
    }
}

private fun launchAddContact(context: Context, phoneNumber: String) {
    try {
        val intent = Intent(Intent.ACTION_INSERT).apply {
            type = ContactsContract.Contacts.CONTENT_TYPE
            putExtra(ContactsContract.Intents.Insert.PHONE, phoneNumber)
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        Toast.makeText(context, "Contacts app not found", Toast.LENGTH_SHORT).show()
    }
}

private fun copyToClipboard(context: Context, text: String, clipboardManager: androidx.compose.ui.platform.ClipboardManager, haptic: androidx.compose.ui.hapticfeedback.HapticFeedback) {
    clipboardManager.setText(AnnotatedString(text))
    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
    Toast.makeText(context, "Number copied", Toast.LENGTH_SHORT).show()
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun KeypadScreen(context: Context) {
    var number by remember { mutableStateOf("") }
    val clipboardManager = LocalClipboardManager.current
    val haptic = LocalHapticFeedback.current

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(modifier = Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = number, 
                    style = MaterialTheme.typography.displayMedium, 
                    maxLines = 1, 
                    textAlign = TextAlign.Center,
                    modifier = Modifier.combinedClickable(
                        onClick = { },
                        onLongClick = { if (number.isNotEmpty()) copyToClipboard(context, number, clipboardManager, haptic) }
                    )
                )
                if (number.isNotEmpty()) {
                    TextButton(
                        onClick = { launchAddContact(context, number) },
                        modifier = Modifier.padding(top = 8.dp)
                    ) {
                        Icon(Icons.Outlined.PersonAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Add to contacts", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }
        Column(modifier = Modifier.padding(bottom = 24.dp)) {
            val rows = listOf(
                listOf("1" to "", "2" to "ABC", "3" to "DEF"),
                listOf("4" to "GHI", "5" to "JKL", "6" to "MNO"),
                listOf("7" to "PQRS", "8" to "TUV", "9" to "WXYZ"),
                listOf("*" to "", "0" to "+", "#" to "")
            )
            for (row in rows) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    for (key in row) {
                        Surface(
                            modifier = Modifier.padding(12.dp).size(76.dp).clip(CircleShape).clickable { number += key.first },
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                            shape = CircleShape
                        ) {
                            Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(text = key.first, fontSize = 28.sp)
                                if (key.second.isNotEmpty()) Text(text = key.second, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(32.dp))
            Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 32.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                // Messaging Button
                Box(
                    modifier = Modifier.size(64.dp).clip(CircleShape).clickable { if (number.isNotEmpty()) launchSms(context, number) },
                    contentAlignment = Alignment.Center
                ) {
                    if (number.isNotEmpty()) Icon(Icons.Default.Textsms, contentDescription = "Message", tint = MaterialTheme.colorScheme.primary)
                    else Spacer(modifier = Modifier.size(64.dp))
                }

                // Call Button
                Box(
                    modifier = Modifier.size(84.dp).clip(CircleShape).background(Color(0xFF4CAF50)).clickable {
                        if (number.isNotEmpty()) {
                            val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:$number"))
                            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) context.startActivity(intent)
                        }
                    },
                    contentAlignment = Alignment.Center
                ) { Icon(Icons.Default.Call, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp)) }

                // Backspace Button
                Box(modifier = Modifier.size(64.dp).clip(CircleShape).clickable { if (number.isNotEmpty()) number = number.dropLast(1) }, contentAlignment = Alignment.Center) {
                    if (number.isNotEmpty()) Icon(Icons.Default.Backspace, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    else Spacer(modifier = Modifier.size(64.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HistoryScreen(context: Context) {
    var history by remember { mutableStateOf<List<CallEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    val clipboardManager = LocalClipboardManager.current
    val haptic = LocalHapticFeedback.current

    LaunchedEffect(searchQuery) {
        withContext(Dispatchers.IO) {
            loading = true
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED) {
                val selection = if (searchQuery.isNotBlank()) {
                    "${CallLog.Calls.NUMBER} LIKE '%$searchQuery%' OR ${CallLog.Calls.CACHED_NAME} LIKE '%$searchQuery%'"
                } else null
                val cursor = context.contentResolver.query(CallLog.Calls.CONTENT_URI, null, selection, null, CallLog.Calls.DATE + " DESC LIMIT 100")
                val list = mutableListOf<CallEntry>()
                cursor?.use {
                    val numCol = it.getColumnIndex(CallLog.Calls.NUMBER)
                    val typeCol = it.getColumnIndex(CallLog.Calls.TYPE)
                    val dateCol = it.getColumnIndex(CallLog.Calls.DATE)
                    val nameCol = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                    while (it.moveToNext()) {
                        list.add(CallEntry(it.getString(nameCol), it.getString(numCol), it.getInt(typeCol), it.getLong(dateCol)))
                    }
                }
                history = list
            }
            loading = false
        }
    }
    Column(modifier = Modifier.fillMaxSize()) {
        Text("Recents", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.padding(start = 24.dp, end = 24.dp, top = 24.dp, bottom = 8.dp))
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 8.dp),
            placeholder = { Text("Search by name or number...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
            shape = RoundedCornerShape(12.dp),
            singleLine = true
        )
        if (loading) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        else LazyColumn(modifier = Modifier.fillMaxSize()) {
            items(history.size) { index ->
                val call = history[index]
                val sdf = SimpleDateFormat("HH:mm", Locale.getDefault())
                val isMissed = call.type == CallLog.Calls.MISSED_TYPE || call.type == CallLog.Calls.REJECTED_TYPE
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .combinedClickable(
                            onClick = {
                                val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:${call.number}"))
                                if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) context.startActivity(intent)
                            },
                            onLongClick = { copyToClipboard(context, call.number, clipboardManager, haptic) }
                        )
                        .padding(horizontal = 24.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Surface(modifier = Modifier.size(48.dp), shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
                        Box(contentAlignment = Alignment.Center) {
                            val initial = if (!call.name.isNullOrEmpty()) call.name.first().uppercase() else ""
                            if (initial.isNotEmpty()) Text(initial) else Icon(Icons.Default.Person, null, modifier = Modifier.size(24.dp))
                        }
                    }
                    Column(modifier = Modifier.weight(1f).padding(start = 16.dp)) {
                        Text(if (!call.name.isNullOrEmpty()) call.name else call.number, fontWeight = FontWeight.SemiBold, color = if (isMissed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            val icon = when(call.type) {
                                CallLog.Calls.INCOMING_TYPE -> Icons.Default.CallReceived
                                CallLog.Calls.OUTGOING_TYPE -> Icons.Default.CallMade
                                CallLog.Calls.MISSED_TYPE -> Icons.Default.CallMissed
                                else -> Icons.Default.Call
                            }
                            Icon(icon, null, modifier = Modifier.size(12.dp), tint = if (isMissed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.width(4.dp))
                            Text("${call.number} • ${sdf.format(Date(call.date))}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    Row {
                        IconButton(onClick = { launchSms(context, call.number) }) {
                            Icon(Icons.Default.Textsms, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
                        }
                        IconButton(onClick = {
                            val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:${call.number}"))
                            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED) context.startActivity(intent)
                        }) { Icon(Icons.Default.Call, null, tint = Color(0xFF4CAF50), modifier = Modifier.size(24.dp)) }
                    }
                }
            }
        }
    }
}

@Composable
fun SyncScreen(context: MainActivity) {
    val prefs = context.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
    if (prefs.getString("token", "").isNullOrEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Login required to view sync queue.") }
        return
    }
    val database = AppDatabase.getDatabase(context)
    val pending by database.callLogDao().getPendingLogsFlow(50, 0).collectAsState(initial = emptyList())
    Column(modifier = Modifier.fillMaxSize()) {
        Text("Sync Queue", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.padding(start = 24.dp, top = 24.dp))
        Box(modifier = Modifier.weight(1f)) {
            if (pending.isEmpty()) Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("All calls synced!") }
            else LazyColumn(modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(top = 8.dp, bottom = 100.dp)) {
                items(pending.size) { index ->
                    val log = pending[index]
                    Card(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 6.dp), shape = RoundedCornerShape(16.dp)) {
                        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.PhonePaused, null, tint = MaterialTheme.colorScheme.primary)
                            Column(Modifier.padding(start = 16.dp)) {
                                Text(log.phoneNumber, style = MaterialTheme.typography.titleSmall)
                                Text("${log.type} • ${log.duration}s • By ${log.disconnectedBy}", style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
            }
            ExtendedFloatingActionButton(
                onClick = {
                    val work = androidx.work.OneTimeWorkRequestBuilder<SyncWorker>().build()
                    androidx.work.WorkManager.getInstance(context).enqueueUniqueWork("ManualSync", androidx.work.ExistingWorkPolicy.REPLACE, work)
                },
                modifier = Modifier.align(Alignment.BottomEnd).padding(24.dp),
                icon = { Icon(Icons.Default.Sync, null) },
                text = { Text("Sync Now") }
            )
        }
    }
}

@Composable
fun SettingsScreen(context: MainActivity) {
    val prefs = context.getSharedPreferences("CallMonitorPrefs", Context.MODE_PRIVATE)
    var isLoggedOut by remember { mutableStateOf(prefs.getString("token", "").isNullOrEmpty()) }
    val serverUrl = "https://call-log-tracker.vercel.app"
    var username by remember { mutableStateOf(prefs.getString("username", "") ?: "") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    
    // Ensure Heartbeat service is running if logged in
    LaunchedEffect(isLoggedOut) {
        if (!isLoggedOut) {
            val intent = Intent(context, HeartbeatService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp)) {
        Text("Settings", style = MaterialTheme.typography.headlineLarge, modifier = Modifier.padding(vertical = 24.dp))
        if (isLoggedOut) {
            Card(shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Text("Agent Login", style = MaterialTheme.typography.titleLarge)
                    Spacer(Modifier.height(16.dp))
                    OutlinedTextField(value = username, onValueChange = { username = it }, label = { Text("Username") }, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(24.dp))
                    Button(onClick = {
                        loading = true
                        scope.launch(Dispatchers.IO) {
                            try {
                                val json = JSONObject().apply { put("username", username); put("password", password) }
                                val request = Request.Builder().url("$serverUrl/api/auth/login").post(json.toString().toRequestBody("application/json".toMediaType())).build()
                                val response = OkHttpClient().newCall(request).execute()
                                val body = response.body?.string()
                                withContext(Dispatchers.Main) {
                                    if (response.isSuccessful && body != null) {
                                        val token = JSONObject(body).getString("token")
                                        prefs.edit().putString("serverUrl", serverUrl).putString("username", username).putString("token", token).apply()
                                        isLoggedOut = false
                                        context.updateAuthNotification(false, username)
                                    } else Toast.makeText(context, "Login failed", Toast.LENGTH_SHORT).show()
                                    loading = false
                                }
                            } catch (e: Exception) { withContext(Dispatchers.Main) { loading = false; Toast.makeText(context, e.message, Toast.LENGTH_SHORT).show() } }
                        }
                    }, modifier = Modifier.fillMaxWidth().height(56.dp), enabled = !loading) { Text(if (loading) "Logging in..." else "Login") }
                }
            }
        } else {
            Card(shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(modifier = Modifier.padding(24.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Surface(modifier = Modifier.size(56.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primary) { Box(Modifier.fillMaxSize(), Alignment.Center) { Icon(Icons.Default.Person, null, tint = Color.White) } }
                        Column(Modifier.padding(start = 16.dp)) {
                            Text(username, style = MaterialTheme.typography.titleLarge)
                            Text("Agent ID: #${username.hashCode().coerceAtLeast(0) % 1000}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                    Button(onClick = {
                        scope.launch(Dispatchers.IO) {
                            try {
                                val url = prefs.getString("serverUrl", "") ?: ""
                                val token = prefs.getString("token", "") ?: ""
                                val logoutRequest = Request.Builder().url("$url/api/agent/logout").header("Authorization", "Bearer $token").post("{}".toRequestBody("application/json".toMediaType())).build()
                                OkHttpClient().newCall( logoutRequest).execute().close()
                            } catch (e: Exception) {}
                            withContext(Dispatchers.Main) {
                                prefs.edit().remove("token").apply()
                                isLoggedOut = true
                                context.stopService(Intent(context, HeartbeatService::class.java))
                                context.updateAuthNotification(true, "")
                            }
                        }
                    }, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text("Logout Agent") }
                }
            }
        }
    }
}