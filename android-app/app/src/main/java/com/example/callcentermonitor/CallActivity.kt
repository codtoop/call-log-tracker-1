package com.example.callcentermonitor

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.ContactsContract
import android.telecom.Call
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.example.callcentermonitor.ui.theme.CallCenterMonitorTheme
import kotlinx.coroutines.delay

class CallActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as android.app.KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
        
        setContent {
            com.example.callcentermonitor.ui.theme.CallCenterMonitorTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF0F0F0F) // Deep obsidian for premium depth
                ) {
                    PremiumCallScreen(this)
                }
            }
        }
    }
}

fun resolveContactName(context: Context, phoneNumber: String?): String? {
    if (phoneNumber.isNullOrEmpty()) return null
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) return null
    try {
        val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(phoneNumber))
        val cursor = context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)
        cursor?.use {
            if (it.moveToFirst()) return it.getString(0)
        }
    } catch (e: Exception) { }
    return null
}

@Composable
fun PremiumCallScreen(context: Context) {
    val call by CallManager.currentCall.collectAsState()
    val callState by CallManager.callState.collectAsState()
    val isMuted by CallManager.isMuted.collectAsState()
    val isSpeakerOn by CallManager.isSpeakerOn.collectAsState()
    val rawNumber = call?.details?.handle?.schemeSpecificPart ?: ""
    val contactName = remember(rawNumber) { resolveContactName(context, rawNumber) }

    var durationText by remember { mutableStateOf("00:00") }

    LaunchedEffect(callState, call) {
        if (callState == Call.STATE_ACTIVE) {
            val vibrator = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as android.os.VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as android.os.Vibrator
            }
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    vibrator.vibrate(android.os.VibrationEffect.createOneShot(200, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(200)
                }
            } catch (e: Exception) { }

            val connectTime = if (call?.details?.connectTimeMillis != null && call!!.details.connectTimeMillis > 0) {
                call!!.details.connectTimeMillis
            } else {
                System.currentTimeMillis()
            }
            while (true) {
                val diff = System.currentTimeMillis() - connectTime
                val seconds = (diff / 1000) % 60
                val minutes = (diff / 1000) / 60
                durationText = String.format("%02d:%02d", minutes, seconds)
                delay(1000)
            }
        } else {
            durationText = "00:00"
        }
    }

    if (call == null || callState == Call.STATE_DISCONNECTED) {
        LaunchedEffect(Unit) {
            delay(1500)
            if (context is CallActivity) context.finish()
        }
        Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0F0F0F)), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Call Ended", color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Bold)
                if (durationText != "00:00") {
                    Text(durationText, color = Color.Gray, fontSize = 18.sp, modifier = Modifier.padding(top = 8.dp))
                }
            }
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(top = 80.dp, bottom = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // TOP: Identity
        val statusText = when (callState) {
            Call.STATE_DIALING -> "Calling..."
            Call.STATE_RINGING -> "Incoming Call"
            Call.STATE_ACTIVE -> durationText
            Call.STATE_HOLDING -> "On Hold"
            else -> "Connecting..."
        }

        Text(text = statusText, color = MaterialTheme.colorScheme.primary, fontSize = 18.sp, fontWeight = FontWeight.Medium)
        Spacer(modifier = Modifier.height(16.dp))
        
        val titleText = contactName ?: rawNumber
        Text(
            text = titleText, 
            color = Color.White, 
            fontSize = 36.sp, 
            fontWeight = FontWeight.SemiBold, 
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 32.dp)
        )
        
        if (contactName != null) {
            Text(text = rawNumber, color = Color.Gray, fontSize = 18.sp, modifier = Modifier.padding(top = 4.dp))
        }

        Spacer(modifier = Modifier.weight(1f))

        // CENTER: Avatar
        Box(
            modifier = Modifier.size(160.dp).clip(CircleShape).background(
                Brush.radialGradient(listOf(Color(0xFF2A2A2A), Color(0xFF1A1A1A)))
            ),
            contentAlignment = Alignment.Center
        ) {
            val initial = if (contactName != null) contactName.first().uppercase() else ""
            if (initial.isNotEmpty()) {
                Text(initial, color = Color.White, fontSize = 72.sp, fontWeight = FontWeight.Light)
            } else {
                Icon(Icons.Default.Person, contentDescription = null, modifier = Modifier.size(80.dp), tint = Color.DarkGray)
            }
        }

        Spacer(modifier = Modifier.weight(1.5f))

        // BOTTOM: Controls
        if (callState == Call.STATE_RINGING) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 64.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                CallActionButton(icon = Icons.Default.CallEnd, color = Color(0xFFE53935), label = "Decline") { CallManager.reject() }
                CallActionButton(icon = Icons.Default.Call, color = Color(0xFF43A047), label = "Answer") { CallManager.answer() }
            }
        } else {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // Control Grid (2x3)
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    ControlButton(icon = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic, label = "Mute", isActive = isMuted) { CallManager.toggleMute() }
                    ControlButton(icon = Icons.Default.Dialpad, label = "Keypad", isActive = false) {}
                    ControlButton(icon = if (isSpeakerOn) Icons.Default.VolumeUp else Icons.Default.VolumeMute, label = "Speaker", isActive = isSpeakerOn) { CallManager.toggleSpeaker() }
                }
                Spacer(modifier = Modifier.height(24.dp))
                Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
                    ControlButton(icon = Icons.Default.Add, label = "Add call", isActive = false) {}
                    ControlButton(icon = Icons.Default.Videocam, label = "Video call", isActive = false) {}
                    ControlButton(icon = Icons.Default.Pause, label = "Hold", isActive = callState == Call.STATE_HOLDING) { CallManager.toggleHold() }
                }

                Spacer(modifier = Modifier.height(56.dp))

                // End Call Prominent Button
                Box(
                    modifier = Modifier.size(84.dp).clip(CircleShape).background(Color(0xFFE53935)).clickable { CallManager.reject() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.CallEnd, contentDescription = "End Call", tint = Color.White, modifier = Modifier.size(38.dp))
                }
            }
        }
    }
}

@Composable
fun CallActionButton(icon: ImageVector, color: Color, label: String, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier.size(76.dp).clip(CircleShape).background(color).clickable { onClick() },
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = label, tint = Color.White, modifier = Modifier.size(32.dp))
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(label, color = Color.White, fontSize = 14.sp)
    }
}

@Composable
fun ControlButton(icon: ImageVector, label: String, isActive: Boolean, onClick: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(90.dp).clickable { onClick() }
    ) {
        val bgColor = if (isActive) Color.White else Color(0xFF222222)
        val iconColor = if (isActive) Color.Black else Color.White
        
        Box(
            modifier = Modifier.size(68.dp).clip(CircleShape).background(bgColor),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = label, tint = iconColor, modifier = Modifier.size(28.dp))
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = label, color = if (isActive) Color.White else Color.Gray, fontSize = 13.sp)
    }
}
