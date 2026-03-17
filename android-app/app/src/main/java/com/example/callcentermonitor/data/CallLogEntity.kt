package com.example.callcentermonitor.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(
    tableName = "call_logs",
    indices = [androidx.room.Index(value = ["phoneNumber", "type", "timestamp"], unique = true)]
)
data class CallLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val phoneNumber: String,
    val type: String,
    val duration: Int,        // actual talk time in seconds
    val ringingDuration: Int = 0, // ringing time in seconds (manually tracked)
    val timestamp: Long,
    val agentToken: String = "",
    val disconnectedBy: String = "UNKNOWN", // "AGENT", "CLIENT", "UNKNOWN"
    var isSynced: Boolean = false
)
