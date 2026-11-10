import ExpoModulesCore
import AVFoundation

public class ExpoAudioRouteModule: Module {
  private var routeChangeObserver: NSObjectProtocol?

  // Every kind of personal listening device iOS reports: wired, Lightning/USB-C,
  // and all Bluetooth profiles (A2DP music, HFP headset, LE audio).
  private static let wiredPorts: Set<AVAudioSession.Port> = [.headphones, .headsetMic, .usbAudio]
  private static let bluetoothPorts: Set<AVAudioSession.Port> = [.bluetoothA2DP, .bluetoothLE, .bluetoothHFP]

  public func definition() -> ModuleDefinition {
    Name("ExpoAudioRoute")

    Events("onAudioRouteChange")

    AsyncFunction("getCurrentRouteAsync") {
      return self.currentRoute()
    }

    AsyncFunction("preferBuiltInMicrophoneAsync") { () -> [String: Any] in
      do {
        _ = try self.configureSession()
        return self.preferBuiltInMic()
      } catch {
        return [
          "applied": false,
          "available": false,
          "platform": "ios",
          "reason": "\(error.localizedDescription)"
        ]
      }
    }

    // When the effects web view opens the microphone, WebKit switches the shared
    // session to call-style audio (voice processing, earpiece routing), which makes
    // the music quiet and thin. Put the session back into music playback: the same
    // play-and-record category in the default (music) mode, high-quality Bluetooth,
    // loudspeaker instead of earpiece. The preferred input is deliberately NOT
    // touched here: switching the mic while it records cuts the recording off.
    AsyncFunction("keepMusicPlaybackAsync") { () -> [String: Any] in
      let session = AVAudioSession.sharedInstance()
      do {
        let changed = try self.configureSession()
        if !self.headphonesConnected(),
           session.currentRoute.outputs.first?.portType == .builtInReceiver {
          try session.overrideOutputAudioPort(.speaker)
        }
        return ["applied": true, "changed": changed, "mode": session.mode.rawValue, "route": self.currentRoute()]
      } catch {
        return ["applied": false, "reason": error.localizedDescription]
      }
    }

    OnStartObserving("onAudioRouteChange") {
      self.startListening()
    }

    OnStopObserving("onAudioRouteChange") {
      self.stopListening()
    }
  }

  /// Play-and-record with high-quality Bluetooth (A2DP) output. HFP is left off on
  /// purpose so Bluetooth headphones keep music quality and never become the mic.
  @discardableResult
  private func configureSession() throws -> Bool {
    let session = AVAudioSession.sharedInstance()
    let options: AVAudioSession.CategoryOptions = [.defaultToSpeaker, .allowBluetoothA2DP, .mixWithOthers]
    var changed = false
    if session.category != .playAndRecord || session.mode != .default || session.categoryOptions != options {
      try session.setCategory(.playAndRecord, mode: .default, options: options)
      changed = true
    }
    try session.setActive(true)
    return changed
  }

  /// Use the phone's own microphone instead of a headset or earbud mic: less
  /// leakage of the music back into the effects.
  private func preferBuiltInMic() -> [String: Any] {
    let session = AVAudioSession.sharedInstance()
    guard let builtInMic = session.availableInputs?.first(where: { $0.portType == .builtInMic }) else {
      return ["applied": false, "available": false, "platform": "ios", "reason": "built_in_microphone_unavailable"]
    }
    if session.preferredInput?.uid == builtInMic.uid {
      return ["applied": true, "available": true, "platform": "ios", "reason": "built_in_microphone_preferred"]
    }
    do {
      try session.setPreferredInput(builtInMic)
    } catch {
      return ["applied": false, "available": true, "platform": "ios", "reason": error.localizedDescription]
    }
    let applied = session.preferredInput?.uid == builtInMic.uid
    return [
      "applied": applied,
      "available": true,
      "platform": "ios",
      "reason": applied ? "built_in_microphone_preferred" : "system_route_override"
    ]
  }

  /// True when any headphones are attached, even if iOS is momentarily routing
  /// sound elsewhere (it does while the microphone starts up).
  private func headphonesConnected() -> Bool {
    return connectedKind() != nil
  }

  private func connectedKind() -> String? {
    let session = AVAudioSession.sharedInstance()
    let outputs = session.currentRoute.outputs.map { $0.portType }
    let inputs = (session.availableInputs ?? []).map { $0.portType } + session.currentRoute.inputs.map { $0.portType }

    if outputs.contains(where: { Self.bluetoothPorts.contains($0) }) || inputs.contains(.bluetoothHFP) {
      return "bluetooth"
    }
    if outputs.contains(where: { Self.wiredPorts.contains($0) })
      || inputs.contains(.headsetMic)
      || inputs.contains(.usbAudio) {
      return "wiredHeadset"
    }
    return nil
  }

  private func currentRoute() -> String {
    if let kind = connectedKind() {
      return kind
    }
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    guard let firstOutput = outputs.first else {
      return "speaker"
    }
    switch firstOutput.portType {
    case .builtInSpeaker, .builtInReceiver:
      return "speaker"
    default:
      // AirPlay, car audio, HDMI and the like: not headphones, but not the
      // phone's speaker either, so the app does not treat it as a disconnect.
      return "unknown"
    }
  }

  private func startListening() {
    routeChangeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self = self else { return }
      let route = self.currentRoute()
      self.sendEvent("onAudioRouteChange", ["route": route])
    }
  }

  private func stopListening() {
    if let observer = routeChangeObserver {
      NotificationCenter.default.removeObserver(observer)
      routeChangeObserver = nil
    }
  }
}
