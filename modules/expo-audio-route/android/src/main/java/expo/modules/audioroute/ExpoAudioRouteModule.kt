package expo.modules.audioroute

import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAudioRouteModule : Module() {
  private var audioManager: AudioManager? = null
  private var deviceCallback: AudioDeviceCallback? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoAudioRoute")

    Events("onAudioRouteChange")

    OnCreate {
      audioManager = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
    }

    AsyncFunction("getCurrentRouteAsync") {
      return@AsyncFunction currentRoute()
    }

    OnStartObserving {
      startListening()
    }

    OnStopObserving {
      stopListening()
    }
  }

  private fun currentRoute(): String {
    val manager = audioManager ?: return "unknown"
    val devices = manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)

    for (device in devices) {
      when (device.type) {
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET -> return "wiredHeadset"
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_BLE_SPEAKER -> return "bluetooth"
      }
    }

    return "speaker"
  }

  private fun startListening() {
    if (deviceCallback != null) return

    deviceCallback = object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
        sendEvent("onAudioRouteChange", mapOf("route" to currentRoute()))
      }

      override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) {
        sendEvent("onAudioRouteChange", mapOf("route" to currentRoute()))
      }
    }

    audioManager?.registerAudioDeviceCallback(deviceCallback, Handler(Looper.getMainLooper()))
  }

  private fun stopListening() {
    deviceCallback?.let {
      audioManager?.unregisterAudioDeviceCallback(it)
    }
    deviceCallback = null
  }
}
