import Foundation
import Capacitor

@objc(KronQemuPlugin)
public class KronQemuPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KronQemuPlugin"
    public let jsName = "KronQemu"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exec", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    @objc func status(_ call: CAPPluginCall) {
        call.resolve([
            "available": false,
            "running": false,
            "backend": "qemu-se",
            "guest": "alpine-arm64",
            "reason": "Native QEMU-SE libraries have not been linked into this build yet"
        ])
    }

    @objc func start(_ call: CAPPluginCall) {
        call.reject("QEMU-SE runtime is not bundled in this build")
    }

    @objc func stop(_ call: CAPPluginCall) {
        call.resolve(["stopped": true])
    }

    @objc func exec(_ call: CAPPluginCall) {
        guard call.getString("command") != nil else {
            call.reject("command is required")
            return
        }
        call.reject("QEMU-SE runtime is not bundled in this build")
    }
}
