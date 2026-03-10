package com.example.callcentermonitor

import android.app.Application
import com.example.callcentermonitor.data.AppDatabase

class CallMonitorApp : Application() {
    
    val database by lazy { AppDatabase.getDatabase(this) }

    override fun onCreate() {
        super.onCreate()
    }
}
