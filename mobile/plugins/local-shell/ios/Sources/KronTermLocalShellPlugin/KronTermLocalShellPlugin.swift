import Capacitor
import Darwin
import Foundation
import ios_system

@objc(KronTermLocalShellPlugin)
public class KronTermLocalShellPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KronTermLocalShellPlugin"
    public let jsName = "KronTermLocalShell"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "run", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "interrupt", returnType: CAPPluginReturnPromise)
    ]

    private let shellQueue = DispatchQueue(label: "dev.kronterm.iphone.local-shell", qos: .userInitiated)
    private var initialized = false
    private var inputStream: UnsafeMutablePointer<FILE>?
    private var outputStream: UnsafeMutablePointer<FILE>?
    private var sessionName: UnsafeMutablePointer<CChar>?
    private var workspaceURL: URL?

    deinit {
        if let sessionName {
            ios_closeSession(UnsafeRawPointer(sessionName))
            free(sessionName)
        }
        if let inputStream {
            fclose(inputStream)
        }
        if let outputStream {
            fclose(outputStream)
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        shellQueue.async { [weak self] in
            guard let self else {
                call.reject("The local shell is unavailable")
                return
            }
            do {
                try self.initializeShell()
                call.resolve([
                    "available": true,
                    "engine": "ios_system",
                    "cwd": self.currentDirectory(),
                    "commands": (commandsAsArray() as? [String]) ?? []
                ])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func run(_ call: CAPPluginCall) {
        guard let command = call.getString("command")?.trimmingCharacters(in: .whitespacesAndNewlines),
              !command.isEmpty else {
            call.reject("A shell command is required")
            return
        }

        shellQueue.async { [weak self] in
            guard let self else {
                call.reject("The local shell is unavailable")
                return
            }
            do {
                try self.initializeShell()
                let result = try self.execute(command)
                call.resolve([
                    "output": result.output,
                    "exitCode": result.exitCode,
                    "cwd": self.currentDirectory()
                ])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func interrupt(_ call: CAPPluginCall) {
        let result = ios_kill()
        if result == 0 || result == ESRCH {
            call.resolve()
            return
        }
        call.reject("Could not interrupt the current command", nil, nil, ["code": result])
    }

    private func initializeShell() throws {
        if initialized {
            return
        }
        guard let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            throw LocalShellError.documentsUnavailable
        }

        let rootURL = documentsURL.appendingPathComponent("KronTerm", isDirectory: true)
        try FileManager.default.createDirectory(at: rootURL, withIntermediateDirectories: true)
        guard let inputStream = tmpfile(), let outputStream = tmpfile() else {
            throw LocalShellError.streamUnavailable
        }
        guard let sessionName = strdup("kronterm-local-shell") else {
            fclose(inputStream)
            fclose(outputStream)
            throw LocalShellError.sessionUnavailable
        }

        self.inputStream = inputStream
        self.outputStream = outputStream
        self.sessionName = sessionName
        self.workspaceURL = rootURL

        ios_switchSession(UnsafeRawPointer(sessionName))
        initializeEnvironment()
        try registerCommands()
        ios_setStreams(inputStream, outputStream, outputStream)
        ios_setDirectoryURL(rootURL)
        ios_setAllowedPaths([documentsURL.path, FileManager.default.temporaryDirectory.path])
        rootURL.path.withCString { path in
            _ = ios_setenv("HOME", path, 1)
        }
        _ = ios_setenv("TERM", "xterm-256color", 1)
        _ = ios_setenv("COLORTERM", "truecolor", 1)
        initialized = true
    }

    private func registerCommands() throws {
        guard let commandListURL = Bundle.module.url(forResource: "commandDictionary", withExtension: "plist") else {
            throw LocalShellError.commandListUnavailable
        }
        if let error = addCommandList(commandListURL.path) {
            throw error
        }
    }

    private func execute(_ command: String) throws -> (output: String, exitCode: Int32) {
        guard let workspaceURL else {
            throw LocalShellError.workspaceUnavailable
        }
        let captureURL = workspaceURL.appendingPathComponent(".kronterm-output")
        try? FileManager.default.removeItem(at: captureURL)
        let escapedPath = captureURL.path.replacingOccurrences(of: "\"", with: "\\\"")
        let capturedCommand = "\(command) > \"\(escapedPath)\" 2>&1"
        let exitCode = capturedCommand.withCString { ios_system($0) }
        let data = (try? Data(contentsOf: captureURL)) ?? Data()
        try? FileManager.default.removeItem(at: captureURL)
        return (String(decoding: data, as: UTF8.self), Int32(exitCode))
    }

    private func currentDirectory() -> String {
        guard let sessionName else {
            return workspaceURL?.path ?? ""
        }
        return ios_getLogicalPWD(UnsafeRawPointer(sessionName)) ?? workspaceURL?.path ?? ""
    }
}

private enum LocalShellError: LocalizedError {
    case commandListUnavailable
    case documentsUnavailable
    case sessionUnavailable
    case streamUnavailable
    case workspaceUnavailable

    var errorDescription: String? {
        switch self {
        case .commandListUnavailable:
            return "The bundled iPhone command list is unavailable"
        case .documentsUnavailable:
            return "The iPhone documents directory is unavailable"
        case .sessionUnavailable:
            return "The local shell session could not be created"
        case .streamUnavailable:
            return "The local shell streams could not be created"
        case .workspaceUnavailable:
            return "The iPhone shell workspace is unavailable"
        }
    }
}
