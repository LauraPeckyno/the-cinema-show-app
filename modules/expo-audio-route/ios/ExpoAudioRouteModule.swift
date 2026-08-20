import ExpoModulesCore
import AVFoundation

public class ExpoAudioRouteModule: Module {
  private var routeChangeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("ExpoAudioRoute")

    Events("onAudioRouteChange")

    AsyncFunction("getCurrentRouteAsync") {
      return self.currentRoute()
    }

    AsyncFunction("preferBuiltInMicrophoneAsync") { () -> [String: Any] in
      let session = AVAudioSession.sharedInstance()

      do {
        // Preserve headset/Bluetooth output where possible while selecting the
        // physical phone microphone as the preferred capture source.
        try session.setCategory(.playAndRecord, mode: .default, options: [.allowBluetoothA2DP])
        try session.setActive(true)

        guard let builtInMic = session.availableInputs?.first(where: {
          $0.portType == .builtInMic
        }) else {
          return [
            "applied": false,
            "available": false,
            "platform": "ios",
            "reason": "built_in_microphone_unavailable"
          ]
        }

        try session.setPreferredInput(builtInMic)
        let applied = session.preferredInput?.uid == builtInMic.uid

        return [
          "applied": applied,
          "available": true,
          "platform": "ios",
          "reason": applied ? "built_in_microphone_preferred" : "system_route_override"
        ]
      } catch {
        return [
          "applied": false,
          "available": false,
          "platform": "ios",
          "reason": "\(error.localizedDescription)"
        ]
      }
    }

    OnStartObserving("onAudioRouteChange") {
      self.startListening()
    }

    OnStopObserving("onAudioRouteChange") {
      self.stopListening()
    }
  }

  private func currentRoute() -> String {
    let session = AVAudioSession.sharedInstance()
    let outputs = session.currentRoute.outputs

    guard let firstOutput = outputs.first else {
      return "speaker"
    }

    switch firstOutput.portType {
    case .headphones, .headsetMic:
      return "wiredHeadset"
    case .bluetoothA2DP, .bluetoothLE, .bluetoothHFP:
      return "bluetooth"
    case .builtInSpeaker, .builtInReceiver:
      return "speaker"
    default:
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
