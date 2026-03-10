package com.example.callcentermonitor.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Delete

@Dao
interface CallLogDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    fun insert(callLog: CallLogEntity)

    // Finds any locally stored log with same phone+type within a 30-second window (timestamps in ms)
    @Query("SELECT * FROM call_logs WHERE phoneNumber = :phone AND type = :type AND ABS(timestamp - :timestamp) <= 30000 LIMIT 1")
    fun findRecentLog(phone: String, type: String, timestamp: Long): CallLogEntity?

    @Query("SELECT * FROM call_logs WHERE isSynced = 0 ORDER BY timestamp ASC")
    fun getAllPendingLogs(): List<CallLogEntity>

    @Query("SELECT * FROM call_logs WHERE isSynced = 0 ORDER BY timestamp ASC LIMIT :limit OFFSET :offset")
    fun getPendingLogsFlow(limit: Int, offset: Int): kotlinx.coroutines.flow.Flow<List<CallLogEntity>>

    @Query("SELECT * FROM call_logs WHERE isSynced = 1 ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    fun getSyncedLogsFlow(limit: Int, offset: Int): kotlinx.coroutines.flow.Flow<List<CallLogEntity>>

    @Query("SELECT COUNT(*) FROM call_logs WHERE isSynced = 0")
    fun getPendingLogsCountFlow(): kotlinx.coroutines.flow.Flow<Int>

    @Query("SELECT COUNT(*) FROM call_logs WHERE isSynced = 1")
    fun getSyncedLogsCountFlow(): kotlinx.coroutines.flow.Flow<Int>

    @androidx.room.Update
    fun updateLogs(logs: List<CallLogEntity>)

    @Delete
    fun deleteLogs(logs: List<CallLogEntity>)

    @Query("DELETE FROM call_logs WHERE phoneNumber = :phone")
    fun deleteLogsByNumber(phone: String)
}
