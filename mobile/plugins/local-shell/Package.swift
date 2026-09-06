// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "KrontermLocalShell",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "KrontermLocalShell", targets: ["KronTermLocalShellPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(name: "ios_system", path: "Vendor/ios-system-binaries")
    ],
    targets: [
        .target(
            name: "KronTermLocalShellPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "ios_system", package: "ios_system")
            ],
            path: "ios/Sources/KronTermLocalShellPlugin",
            resources: [.process("Resources")]
        )
    ]
)
