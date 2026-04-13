package com.example.callcentermonitor

import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

object CallManager {
    var inCallService: InCallService? = null
    var explicitAgentHangup = false

    private val _currentCall = MutableStateFlow<Call?>(null)
    val currentCall: StateFlow<Call?> = _currentCall

    private val _callState = MutableStateFlow<Int>(Call.STATE_NEW)
    val callState: StateFlow<Int> = _callState

    private val _isMuted = MutableStateFlow(false)
    val isMuted: StateFlow<Boolean> = _isMuted
    
    private val _isSpeakerOn = MutableStateFlow(false)
    val isSpeakerOn: StateFlow<Boolean> = _isSpeakerOn

    fun updateCall(call: Call?) {
        if (call != null && call != _currentCall.value) {
            explicitAgentHangup = false
        }
        _currentCall.value = call
        if (call != null) {
            _callState.value = call.state
        } else {
            _callState.value = Call.STATE_DISCONNECTED
            explicitAgentHangup = false
        }
    }
    
    fun updateAudioState(state: CallAudioState?) {
        if (state != null) {
            _isMuted.value = state.isMuted
            _isSpeakerOn.value = state.route == CallAudioState.ROUTE_SPEAKER
        }
    }
    
    fun answer() {
        _currentCall.value?.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY)
    }
    
    fun reject() {
        explicitAgentHangup = true
        val state = _currentCall.value?.state
        if (state == Call.STATE_RINGING) {
            _currentCall.value?.reject(false, null)
        } else {
            _currentCall.value?.disconnect()
        }
    }

    fun toggleMute() {
        val newState = !_isMuted.value
        inCallService?.setMuted(newState)
        _isMuted.value = newState
    }
    
    fun toggleSpeaker() {
        val newState = !_isSpeakerOn.value
        if (newState) {
            inCallService?.setAudioRoute(CallAudioState.ROUTE_SPEAKER)
        } else {
            inCallService?.setAudioRoute(CallAudioState.ROUTE_EARPIECE)
        }
        _isSpeakerOn.value = newState
    }
    
    fun toggleHold() {
        val call = _currentCall.value ?: return
        if (call.state == Call.STATE_HOLDING) {
            call.unhold()
        } else if (call.state == Call.STATE_ACTIVE) {
            call.hold()
        }
    }
}
