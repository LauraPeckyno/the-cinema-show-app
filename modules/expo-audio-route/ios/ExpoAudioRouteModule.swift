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
