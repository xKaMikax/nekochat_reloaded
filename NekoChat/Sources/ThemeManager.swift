import Foundation

struct ThemeError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

/// Swift port of the theme system in main.js (same as ThemeManager.kt on Android):
/// built-in prebuilt themes from the bundle, user themes (catalog / import) and on-device
/// msstyles rendering (MsStylesImporter). All methods are blocking: call them off the main thread.
final class ThemeManager {
    static let catalogRoot = "https://raw.githubusercontent.com/xKaMikax/nekochat_reloaded_themes/main"
    private static let reservedIds: Set<String> = ["Current", "Luna", "Embedded", "Royale"]

    let userThemesRoot: URL
    let runtimeThemesRoot: URL
    let userPacksRoot: URL
    private let prebuiltRoot = Bundle.main.resourceURL!.appendingPathComponent("web/prebuilt", isDirectory: true)
    private let themeStateFile: URL
    private let displayStateFile: URL
    private let files = FileManager.default
    private let lock = NSLock()

    private(set) var activeTheme: [String: Any]?
    private(set) var activeDisplay: [String: Any] = ["language": "ru", "loginUi": "xp", "micDeviceId": "", "noiseSuppression": "webrtc"]

    private struct Theme {
        let id: String
        let prebuilt: Bool
        var source: URL?
        var css = false
        var userInstalled = false
        var catalogId: String?
        var schemed = false
    }

    private struct Prepared {
        let theme: Theme
        let baseUrl: String
        let metadata: [String: Any]
        let css: Bool
    }

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        userThemesRoot = support.appendingPathComponent("themes", isDirectory: true)
        runtimeThemesRoot = support.appendingPathComponent("runtime-themes", isDirectory: true)
        userPacksRoot = support.appendingPathComponent("packs", isDirectory: true)
        themeStateFile = support.appendingPathComponent("theme-selection.json")
        displayStateFile = support.appendingPathComponent("display-settings.json")
        try? FileManager.default.createDirectory(at: userThemesRoot, withIntermediateDirectories: true)
        try? FileManager.default.createDirectory(at: runtimeThemesRoot, withIntermediateDirectories: true)
    }

    func load() {
        if let saved = readJSON(displayStateFile) as? [String: Any] { activeDisplay.merge(saved) { _, new in new } }
        var saved = readJSON(themeStateFile) as? [String: Any] ?? ["id": "Classic"]
        if (saved["id"] as? String)?.lowercased() == "aero" { saved = ["id": "Classic", "scheme": "classic"] }
        do { _ = try activateTheme(id: saved["id"] as? String ?? "Classic", requestedScheme: (saved["scheme"] as? String).flatMap { $0.isEmpty ? nil : $0 }) }
        catch { _ = try? activateTheme(id: "Classic", requestedScheme: "classic") }
    }

    func saveDisplaySettings(_ settings: [String: Any]) throws -> [String: Any] {
        activeDisplay = [
            "language": settings["language"] as? String == "en" ? "en" : "ru",
            "loginUi": settings["loginUi"] as? String == "classic" ? "classic" : "xp",
            "micDeviceId": settings["micDeviceId"] as? String ?? "",
            "noiseSuppression": ["off", "rnnoise"].contains(settings["noiseSuppression"] as? String ?? "") ? settings["noiseSuppression"] as! String : "webrtc",
        ]
        try writeJSON(activeDisplay, to: displayStateFile)
        return activeDisplay
    }

    // MARK: - Discovery

    private func discoverThemes() -> [Theme] {
        var found: [Theme] = []
        let prebuilt = (try? files.contentsOfDirectory(atPath: prebuiltRoot.path)) ?? []
        for id in prebuilt.sorted() where files.fileExists(atPath: prebuiltRoot.appendingPathComponent("\(id)/theme.json").path) {
            found.append(Theme(id: id, prebuilt: true))
        }
        let user = (try? files.contentsOfDirectory(at: userThemesRoot, includingPropertiesForKeys: [.isDirectoryKey])) ?? []
        for directory in user.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            guard (try? directory.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true, !directory.lastPathComponent.hasPrefix("."), !Self.reservedIds.contains(directory.lastPathComponent) else { continue }
            let names = ((try? files.contentsOfDirectory(atPath: directory.path)) ?? []).sorted()
            // A CSS theme with colour schemes: schemes/<scheme>/theme.css (names in an optional theme.json).
            let schemeFolders = (try? files.contentsOfDirectory(atPath: directory.appendingPathComponent("schemes").path)) ?? []
            let schemed = !names.contains(where: { $0.lowercased().hasSuffix(".theme") || $0.lowercased().hasSuffix(".msstyles") || $0.lowercased() == "theme.css" })
                && schemeFolders.contains(where: { files.fileExists(atPath: directory.appendingPathComponent("schemes/\($0)/theme.css").path) })
            guard let source = names.first(where: { $0.lowercased().hasSuffix(".theme") })
                    ?? names.first(where: { $0.lowercased().hasSuffix(".msstyles") })
                    ?? names.first(where: { $0.lowercased() == "theme.css" })
                    ?? (schemed ? "theme.css" : nil) else { continue }
            let catalogId = (readJSON(directory.appendingPathComponent("catalog-theme.json")) as? [String: Any])?["id"] as? String
            let id = directory.lastPathComponent
            found.removeAll { $0.id == id }
            found.append(Theme(id: id, prebuilt: false, source: directory.appendingPathComponent(source), css: source.lowercased() == "theme.css", userInstalled: true, catalogId: catalogId, schemed: schemed))
        }
        return found
    }

    private func prepareTheme(_ id: String) throws -> Prepared {
        guard let theme = discoverThemes().first(where: { $0.id == id }) else { throw ThemeError("Theme not found") }
        if theme.prebuilt {
            guard let metadata = readJSON(prebuiltRoot.appendingPathComponent("\(id)/theme.json")) as? [String: Any] else { throw ThemeError("Theme not found") }
            return Prepared(theme: theme, baseUrl: "\(WebViewController.origin)/prebuilt/\(Self.encode(id))", metadata: metadata, css: false)
        }
        let source = theme.source!
        if theme.css && theme.schemed { return try materializeSchemedCssTheme(theme, root: source.deletingLastPathComponent()) }
        if theme.css {
            let metadata: [String: Any] = ["theme": id, "schemes": [["id": "default", "name": "Default"]], "defaultScheme": "default"]
            return Prepared(theme: theme, baseUrl: try materializeCssTheme(id: id, source: source), metadata: metadata, css: true)
        }
        let output = runtimeThemesRoot.appendingPathComponent(id, isDirectory: true)
        let attributes = try files.attributesOfItem(atPath: source.path)
        let modified = (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
        let stamp = "\(modified):\((attributes[.size] as? NSNumber)?.intValue ?? 0):\(MsStylesImporter.version)"
        if (readJSON(output.appendingPathComponent(".cache.json")) as? [String: Any])?["stamp"] as? String != stamp {
            try? files.removeItem(at: output)
            try MsStylesImporter.importTheme(source: source, output: output, assetUrl: "\(WebViewController.origin)/runtime-themes/\(Self.encode(id))")
            try writeJSON(["stamp": stamp], to: output.appendingPathComponent(".cache.json"))
        }
        guard let metadata = readJSON(output.appendingPathComponent("theme.json")) as? [String: Any] else { throw ThemeError("Theme not found") }
        return Prepared(theme: theme, baseUrl: "\(WebViewController.origin)/runtime-themes/\(Self.encode(id))", metadata: metadata, css: false)
    }

    /// A url() inside a custom property resolves against the stylesheet that uses the variable,
    /// not theme.css, so relative pictures (themes from the PC theme editor) are made absolute
    /// in a runtime copy of theme.css.
    private func materializeCssTheme(id: String, source: URL) throws -> String {
        let base = "\(WebViewController.origin)/user-themes/\(Self.encode(id))"
        let css = try String(contentsOf: source, encoding: .utf8)
        let pattern = try NSRegularExpression(pattern: "url\\((['\"]?)([^'\")]+)\\1\\)")
        let absolute = try NSRegularExpression(pattern: "^(data|file|https?|blob):", options: .caseInsensitive)
        let whole = NSRange(css.startIndex..., in: css)
        let matches = pattern.matches(in: css, range: whole)
        let isAbsolute = { (url: String) in absolute.firstMatch(in: url, range: NSRange(url.startIndex..., in: url)) != nil }
        if matches.allSatisfy({ isAbsolute((css as NSString).substring(with: $0.range(at: 2))) }) { return base }
        var output = css as NSString
        for match in matches.reversed() {
            let url = (css as NSString).substring(with: match.range(at: 2))
            if isAbsolute(url) { continue }
            let path = url.hasPrefix("./") ? String(url.dropFirst(2)) : url
            output = output.replacingCharacters(in: match.range, with: "url(\"\(base)/\(path.split(separator: "/").map { Self.encode(String($0)) }.joined(separator: "/"))\")") as NSString
        }
        let folder = runtimeThemesRoot.appendingPathComponent("css-\(id)", isDirectory: true)
        try files.createDirectory(at: folder, withIntermediateDirectories: true)
        try (output as String).write(to: folder.appendingPathComponent("theme.css"), atomically: true, encoding: .utf8)
        return "\(WebViewController.origin)/runtime-themes/\(Self.encode("css-\(id)"))"
    }

    /// Every scheme becomes runtime-themes/css-<id>/schemes/<scheme>/theme.css with absolute picture URLs.
    private func materializeSchemedCssTheme(_ theme: Theme, root: URL) throws -> Prepared {
        let info = readJSON(root.appendingPathComponent("theme.json")) as? [String: Any] ?? [:]
        var names: [String: String] = [:]
        for item in info["schemes"] as? [[String: Any]] ?? [] { if let id = item["id"] as? String { names[id] = item["name"] as? String ?? id } }
        let output = runtimeThemesRoot.appendingPathComponent("css-\(theme.id)", isDirectory: true)
        let pattern = try NSRegularExpression(pattern: "url\\((['\"]?)([^'\")]+)\\1\\)")
        let absolute = try NSRegularExpression(pattern: "^(data|file|https?|blob):", options: .caseInsensitive)
        var schemes: [[String: Any]] = []
        let folders = ((try? files.contentsOfDirectory(atPath: root.appendingPathComponent("schemes").path)) ?? []).sorted()
        for folder in folders where folder.range(of: "^[\\w.-]+$", options: .regularExpression) != nil {
            guard let css = try? String(contentsOf: root.appendingPathComponent("schemes/\(folder)/theme.css"), encoding: .utf8) else { continue }
            let base = "\(WebViewController.origin)/user-themes/\(Self.encode(theme.id))/schemes/\(Self.encode(folder))"
            var result = css as NSString
            for match in pattern.matches(in: css, range: NSRange(css.startIndex..., in: css)).reversed() {
                let url = (css as NSString).substring(with: match.range(at: 2))
                if absolute.firstMatch(in: url, range: NSRange(url.startIndex..., in: url)) != nil { continue }
                let path = url.hasPrefix("./") ? String(url.dropFirst(2)) : url
                result = result.replacingCharacters(in: match.range, with: "url(\"\(base)/\(path.split(separator: "/").map { Self.encode(String($0)) }.joined(separator: "/"))\")") as NSString
            }
            let target = output.appendingPathComponent("schemes/\(folder)", isDirectory: true)
            try files.createDirectory(at: target, withIntermediateDirectories: true)
            try (result as String).write(to: target.appendingPathComponent("theme.css"), atomically: true, encoding: .utf8)
            schemes.append(["id": folder, "name": names[folder] ?? folder])
        }
        guard let first = schemes.first?["id"] as? String else { throw ThemeError("The theme has no colour schemes.") }
        let wanted = info["defaultScheme"] as? String
        let defaultScheme = schemes.contains(where: { $0["id"] as? String == wanted }) ? wanted! : first
        let metadata: [String: Any] = ["theme": info["name"] as? String ?? theme.id, "schemes": schemes, "defaultScheme": defaultScheme]
        return Prepared(theme: theme, baseUrl: "\(WebViewController.origin)/runtime-themes/\(Self.encode("css-\(theme.id)"))", metadata: metadata, css: false)
    }

    // MARK: - Settings backups

    /// Installed themes as backup entries ("themes/<id>/…", base64), like exportUserThemes() in main.js.
    func exportThemeFiles() throws -> [[String: Any]] {
        lock.lock(); defer { lock.unlock() }
        var result: [[String: Any]] = []
        // Installed packs (cursors, sounds, icons) travel with the themes, under packs/.
        for (prefix, folder) in [("themes", userThemesRoot), ("packs", userPacksRoot)] {
            let root = folder.standardizedFileURL
            guard let enumerator = files.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey]) else { continue }
            for case let file as URL in enumerator {
                guard (try? file.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true else { continue }
                let relative = String(file.standardizedFileURL.path.dropFirst(root.path.count + 1))
                if relative.hasPrefix(".") { continue }
                result.append(["path": "\(prefix)/\(relative)", "data": try Data(contentsOf: file).base64EncodedString()])
            }
        }
        return result
    }

    /// Adds the themes of a backup archive to the installed ones; nothing installed is removed.
    func restoreThemeFiles(_ archiveBase64: String) throws -> [[String: Any]] {
        guard let archive = Data(base64Encoded: archiveBase64) else { throw ThemeError("The backup could not be read.") }
        lock.lock(); defer { lock.unlock() }
        let temporary = files.temporaryDirectory.appendingPathComponent("backup-\(UUID().uuidString)", isDirectory: true)
        defer { try? files.removeItem(at: temporary) }
        try ZipReader.extract(archive, to: temporary)
        let themesFolder = temporary.appendingPathComponent("themes", isDirectory: true)
        try files.createDirectory(at: userThemesRoot, withIntermediateDirectories: true)
        for theme in (try? files.contentsOfDirectory(at: themesFolder, includingPropertiesForKeys: [.isDirectoryKey])) ?? [] {
            guard (try? theme.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true, !Self.reservedIds.contains(theme.lastPathComponent) else { continue }
            let destination = userThemesRoot.appendingPathComponent(theme.lastPathComponent, isDirectory: true)
            try? files.removeItem(at: destination)
            try files.copyItem(at: theme, to: destination)
        }
        try files.createDirectory(at: userPacksRoot, withIntermediateDirectories: true)
        for pack in (try? files.contentsOfDirectory(at: temporary.appendingPathComponent("packs", isDirectory: true), includingPropertiesForKeys: [.isDirectoryKey])) ?? [] {
            guard (try? pack.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true else { continue }
            let destination = userPacksRoot.appendingPathComponent(pack.lastPathComponent, isDirectory: true)
            try? files.removeItem(at: destination)
            try files.copyItem(at: pack, to: destination)
        }
        return listThemesLocked()
    }

    private func cssUrl(_ prepared: Prepared, scheme: String, revision: Int64) -> String {
        let directory = prepared.css ? prepared.baseUrl : "\(prepared.baseUrl)/schemes/\(Self.encode(scheme))"
        return "\(directory)/theme.css?theme=\(revision)"
    }

    private func hasScheme(_ metadata: [String: Any], _ scheme: String) -> Bool {
        (metadata["schemes"] as? [[String: Any]])?.contains { $0["id"] as? String == scheme } ?? false
    }

    private static func now() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

    // MARK: - Public API (mirrors ipcMain handlers)

    func listThemes() throws -> [[String: Any]] {
        lock.lock(); defer { lock.unlock() }
        return listThemesLocked()
    }

    private func listThemesLocked() -> [[String: Any]] {
        discoverThemes().compactMap { theme -> [String: Any]? in
            guard let prepared = try? prepareTheme(theme.id) else { return nil }
            var name = prepared.metadata["theme"] as? String ?? theme.id
            if name.isEmpty { name = theme.id }
            name = name.replacingOccurrences(of: #"\.(theme|msstyles)$"#, with: "", options: [.regularExpression, .caseInsensitive])
            return ["id": theme.id, "name": name, "schemes": prepared.metadata["schemes"] ?? [], "removable": theme.userInstalled, "catalogId": theme.catalogId ?? NSNull()]
        }
    }

    func previewTheme(id: String, scheme: String?) throws -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        let prepared = try prepareTheme(id)
        let active = scheme ?? prepared.metadata["defaultScheme"] as? String ?? ""
        let revision = Self.now()
        return ["id": id, "scheme": active, "revision": revision, "cssUrl": cssUrl(prepared, scheme: active, revision: revision)]
    }

    func activateTheme(id: String, requestedScheme: String?) throws -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        return try activateThemeLocked(id: id, requestedScheme: requestedScheme)
    }

    private func activateThemeLocked(id: String, requestedScheme: String?) throws -> [String: Any] {
        guard id.range(of: #"^[a-zA-Z0-9._ -]+$"#, options: .regularExpression) != nil,
              requestedScheme.map({ $0.range(of: #"^[a-zA-Z0-9._-]+$"#, options: .regularExpression) != nil }) ?? true else { throw ThemeError("Invalid theme name") }
        let prepared = try prepareTheme(id)
        let scheme = requestedScheme ?? prepared.metadata["defaultScheme"] as? String ?? ""
        guard hasScheme(prepared.metadata, scheme) else { throw ThemeError("Unknown colour scheme") }
        let revision = Self.now()
        let theme: [String: Any] = ["id": id, "scheme": scheme, "revision": revision, "cssUrl": cssUrl(prepared, scheme: scheme, revision: revision)]
        activeTheme = theme
        try writeJSON(["id": id, "scheme": scheme], to: themeStateFile)
        return theme
    }

    func removeTheme(id: String) throws -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        guard let theme = discoverThemes().first(where: { $0.id == id }), theme.userInstalled else { throw ThemeError("Built-in themes cannot be removed.") }
        if activeTheme?["id"] as? String == id { _ = try activateThemeLocked(id: "Classic", requestedScheme: "classic") }
        let directory = userThemesRoot.appendingPathComponent(id, isDirectory: true).standardizedFileURL
        guard directory.deletingLastPathComponent().path == userThemesRoot.standardizedFileURL.path else { throw ThemeError("Invalid theme location.") }
        try? files.removeItem(at: directory)
        try? files.removeItem(at: runtimeThemesRoot.appendingPathComponent(id))
        return ["themes": listThemesLocked(), "activeTheme": activeTheme ?? NSNull()]
    }

    /// Imports a user-picked file: .msstyles, .theme, theme.css or a .zip bundle.
    func importTheme(fileName: String, data: Data) throws -> [String: Any] {
        lock.lock(); defer { lock.unlock() }
        let stem = (fileName as NSString).deletingPathExtension
        var base = String(stem.replacingOccurrences(of: #"[^a-zA-Z0-9._ -]"#, with: "_", options: .regularExpression).prefix(60))
        if base.isEmpty { base = "Custom-theme" }
        let destination = userThemesRoot.appendingPathComponent("\(base)-\(Self.now())", isDirectory: true)
        let lower = fileName.lowercased()
        do {
            if lower.hasSuffix(".zip") {
                try installBundle(data, destination: destination)
            } else if lower.hasSuffix(".css") {
                try files.createDirectory(at: destination, withIntermediateDirectories: true)
                try data.write(to: destination.appendingPathComponent("theme.css"))
            } else if lower.hasSuffix(".msstyles") || lower.hasSuffix(".theme") {
                try files.createDirectory(at: destination, withIntermediateDirectories: true)
                try data.write(to: destination.appendingPathComponent(fileName.replacingOccurrences(of: "/", with: "_")))
            } else {
                throw ThemeError("Выберите файл .msstyles, .theme, theme.css или .zip с темой.")
            }
            let id = destination.lastPathComponent
            let prepared = try prepareTheme(id)
            let scheme = prepared.metadata["defaultScheme"] as? String ?? ""
            let revision = Self.now()
            return ["themes": listThemesLocked(), "id": id, "scheme": scheme, "revision": revision, "cssUrl": cssUrl(prepared, scheme: scheme, revision: revision)]
        } catch {
            try? files.removeItem(at: destination)
            try? files.removeItem(at: runtimeThemesRoot.appendingPathComponent(destination.lastPathComponent))
            throw error
        }
    }

    // MARK: - Catalog

    private func catalogEntries(_ manifest: Any) -> [[String: Any]] {
        var entries: [[String: Any]] = []
        if let array = manifest as? [Any] {
            entries = array.map { $0 as? [String: Any] ?? [:] }
        } else if let object = manifest as? [String: Any], let themes = object["themes"] as? [Any] {
            entries = themes.map { $0 as? [String: Any] ?? [:] }
        } else if let object = manifest as? [String: Any] {
            entries = object.keys.sorted().map { key -> [String: Any] in var entry = object[key] as? [String: Any] ?? [:]; entry["theme_id"] = key; return entry }
        }
        return entries.enumerated().map { (index, entry) -> [String: Any] in
            func pick(_ keys: String...) -> String? {
                for key in keys { if let value = entry[key], !(value is NSNull) { let text = "\(value)"; if !text.isEmpty { return text } } }
                return nil
            }
            let details = entry["Details"] as? [String: Any] ?? entry["details"] as? [String: Any] ?? [:]
            func detail(_ keys: String...) -> String? { keys.lazy.compactMap { details[$0] as? String }.first { !$0.isEmpty } }
            let themeId = pick("theme_id", "id") ?? "theme-\(index + 1)"
            let directory = (pick("directory") ?? themeId).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let schemes = entry["ColorSchemes"] ?? entry["ColorShemas"] ?? entry["colorSchemes"] ?? []
            return [
                "id": themeId, "directory": directory,
                "displayName": pick("DisplayName", "displayName") ?? themeId,
                "colorSchemes": schemes,
                "type": detail("Type", "type") ?? pick("Type", "type") ?? "WindowsThemeFile",
                "author": detail("Author", "author") ?? pick("Author", "author") ?? "Unknown",
                "version": detail("Version", "version") ?? pick("Version", "version") ?? "Unknown",
                "previewUrl": pick("Preview", "preview") ?? "\(Self.catalogRoot)/\(directory)/Preview.png",
                "descriptionUrl": pick("Description", "description") ?? "\(Self.catalogRoot)/\(directory)/Description.md",
                "detailsUrl": pick("DetailsFile", "detailsFile") ?? "\(Self.catalogRoot)/\(directory)/Details.json",
                "zipUrl": pick("ThemeZIP", "themeZip") ?? "\(Self.catalogRoot)/\(directory)/Theme.ZIP",
            ]
        }
    }

    func fetchCatalog() throws -> [[String: Any]] {
        let (status, body) = try Self.download("\(Self.catalogRoot)/themes.json")
        guard (200..<300).contains(status) else { throw ThemeError(status == 404 ? "Theme catalog has not been published yet." : "Unable to load theme catalog (\(status)).") }
        return catalogEntries(try JSONSerialization.jsonObject(with: body))
    }

    private func catalogItem(_ id: String) throws -> [String: Any] {
        guard let item = try fetchCatalog().first(where: { $0["id"] as? String == id }) else { throw ThemeError("Theme no longer exists in the catalog.") }
        return item
    }

    func fetchCatalogThemeDetails(id: String) throws -> [String: Any] {
        var item = try catalogItem(id)
        var description = ""
        if let url = item["descriptionUrl"] as? String, let downloaded = try? Self.download(url), (200..<300).contains(downloaded.0) {
            description = String(data: downloaded.1, encoding: .utf8) ?? ""
        }
        item["description"] = description
        return item
    }

    // MARK: - Catalog packs: cursors, sounds, icons and combos (like main.js)

    func fetchCatalogPacks() throws -> [[String: Any]] {
        let (status, data) = try Self.download("\(Self.catalogRoot)/packs.json")
        if status == 404 { return [] }
        guard (200..<300).contains(status) else { throw ThemeError("Unable to load the catalog (\(status)).") }
        let entries = ((try? JSONSerialization.jsonObject(with: data)) as? [String: Any])?["packs"] as? [[String: Any]] ?? []
        return entries.enumerated().map { index, entry in
            let details = entry["Details"] as? [String: Any] ?? entry["details"] as? [String: Any] ?? [:]
            let id = entry["pack_id"] as? String ?? entry["id"] as? String ?? "pack-\(index + 1)"
            let directory = (entry["directory"] as? String ?? id).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let rawType = (entry["type"] as? String ?? entry["Type"] as? String ?? "").lowercased()
            let type = ["cursors", "sounds", "icons", "wallpapers", "assistants", "addons", "combo"].contains(rawType) ? rawType : "combo"
            // Plain files instead of Pack.ZIP: "Files": ["Autumn.jpg"] in the folder, installed under <type>/.
            let fileList = (entry["Files"] as? [String] ?? entry["files"] as? [String] ?? []).filter { !$0.isEmpty && !$0.contains("/") && !$0.contains("\\") && $0 != "." && $0 != ".." }
            // A wallpapers pack without Preview.png shows its first picture.
            let firstPicture: String? = type == "wallpapers" ? fileList.first : nil
            let preview: String = entry["Preview"] as? String ?? (firstPicture.map { "\(Self.catalogRoot)/\(directory)/\(Self.encode($0))" } ?? "\(Self.catalogRoot)/\(directory)/Preview.png")
            // A combo is only a list of other catalog items: { theme, cursors, sounds, icons } → their ids.
            let includes = type == "combo" ? (entry["Includes"] as? [String: String] ?? entry["includes"] as? [String: String]) : nil
            return ["id": id, "type": type, "kind": "pack", "directory": directory, "displayName": entry["DisplayName"] as? String ?? id, "includes": includes ?? NSNull(),
                    "contains": includes.map { Array($0.keys) } ?? entry["Contains"] as? [String] ?? entry["contains"] as? [String] ?? [type],
                    "author": details["Author"] as? String ?? entry["Author"] as? String ?? "Unknown", "added": details["Added"] as? String ?? entry["Added"] as? String ?? "",
                    "version": details["Version"] as? String ?? "", "files": fileList,
                    // Add-ons (like the Theme Editor) may need the desktop app: "Platforms": ["desktop"].
                    "platforms": (entry["Platforms"] as? [String] ?? entry["platforms"] as? [String]).map { $0 as Any } ?? NSNull(),
                    "previewUrl": preview,
                    "descriptionUrl": entry["Description"] as? String ?? "\(Self.catalogRoot)/\(directory)/Description.md",
                    "zipUrl": entry["PackZIP"] as? String ?? "\(Self.catalogRoot)/\(directory)/Pack.ZIP"]
        }
    }

    func installCatalogPack(id: String) throws -> [String: Any] {
        let catalog = try fetchCatalogPacks()
        guard let item = catalog.first(where: { $0["id"] as? String == id }) else { throw ThemeError("The pack no longer exists in the catalog.") }
        if let includes = item["includes"] as? [String: String] { return try installCombo(item, includes: includes, catalog: catalog) }
        let safe = id.replacingOccurrences(of: #"[^a-zA-Z0-9._-]"#, with: "_", options: .regularExpression)
        let temporary = files.temporaryDirectory.appendingPathComponent("pack-\(UUID().uuidString)", isDirectory: true)
        defer { try? files.removeItem(at: temporary) }
        let fileList = item["files"] as? [String] ?? []
        if !fileList.isEmpty {
            // No Pack.ZIP: download the listed files into the folder of the pack's type.
            let typeName = item["type"] as? String ?? "combo"
            let folder = temporary.appendingPathComponent(["assistants": "assistant", "addons": "addon"][typeName] ?? typeName, isDirectory: true)
            try files.createDirectory(at: folder, withIntermediateDirectories: true)
            for name in fileList {
                let (status, data) = try Self.download("\(Self.catalogRoot)/\(item["directory"] as? String ?? id)/\(Self.encode(name))")
                guard (200..<300).contains(status) else { throw ThemeError("Unable to download \(name) (\(status)).") }
                try data.write(to: folder.appendingPathComponent(name))
            }
        } else {
            let (status, zip) = try Self.download(item["zipUrl"] as? String ?? "")
            guard (200..<300).contains(status) else { throw ThemeError("Unable to download Pack.ZIP (\(status)).") }
            try ZipReader.extract(zip, to: temporary)
        }
        lock.lock(); defer { lock.unlock() }
        let info = readJSON(temporary.appendingPathComponent("pack.json")) as? [String: Any] ?? [:]
        let contains = ["sounds", "cursors", "icons", "wallpapers", "assistant", "addon", "theme"].filter { var dir: ObjCBool = false; return files.fileExists(atPath: temporary.appendingPathComponent($0).path, isDirectory: &dir) && dir.boolValue }
        // The theme of a combo goes to the installed themes, like a catalog theme.
        var themeId: Any = NSNull()
        if contains.contains("theme") {
            let themeDestination = userThemesRoot.appendingPathComponent("\(safe)-theme", isDirectory: true)
            try? files.removeItem(at: themeDestination)
            try installThemeFolder(temporary.appendingPathComponent("theme"), destination: themeDestination)
            try writeJSON(["id": "pack:\(id)"], to: themeDestination.appendingPathComponent("catalog-theme.json"))
            themeId = themeDestination.lastPathComponent
        }
        let destination = userPacksRoot.appendingPathComponent(safe, isDirectory: true)
        try? files.removeItem(at: destination)
        try files.createDirectory(at: destination, withIntermediateDirectories: true)
        for part in contains where part != "theme" { try files.copyItem(at: temporary.appendingPathComponent(part), to: destination.appendingPathComponent(part)) }
        try writeJSON(["catalogId": id, "type": item["type"] ?? "combo", "name": info["name"] as? String ?? item["displayName"] ?? id, "author": info["author"] as? String ?? item["author"] ?? "", "contains": contains, "theme": themeId], to: destination.appendingPathComponent("pack.json"))
        return ["id": safe, "packs": listPacksLocked(), "themes": listThemesLocked()]
    }

    /// Installs every item a combo lists (skipping what is already installed) and remembers them.
    private func installCombo(_ item: [String: Any], includes: [String: String], catalog: [[String: Any]]) throws -> [String: Any] {
        var themeId: Any = NSNull()
        if let ref = includes["theme"], !ref.isEmpty {
            let existing = try listThemes().first(where: { $0["catalogId"] as? String == ref })
            if let existingId = existing?["id"] as? String { themeId = existingId }
            else { let installed = try installCatalogTheme(id: ref); themeId = installed["id"] ?? NSNull() }
        }
        var parts: [String] = []
        for part in ["cursors", "sounds", "icons", "wallpapers", "assistants"] {
            guard let ref = includes[part], !ref.isEmpty else { continue }
            guard catalog.contains(where: { $0["id"] as? String == ref && $0["includes"] is NSNull }) else { throw ThemeError("The combo lists a missing \(part) pack: \(ref)") }
            if let existing = listPacks().first(where: { $0["catalogId"] as? String == ref }), let existingId = existing["id"] as? String { parts.append(existingId) }
            else if let newId = try installCatalogPack(id: ref)["id"] as? String { parts.append(newId) }
        }
        lock.lock(); defer { lock.unlock() }
        let safe = (item["id"] as? String ?? "combo").replacingOccurrences(of: #"[^a-zA-Z0-9._-]"#, with: "_", options: .regularExpression)
        try writeJSON(["catalogId": item["id"] ?? safe, "type": "combo", "name": item["displayName"] ?? safe, "author": item["author"] ?? "", "contains": Array(includes.keys), "theme": themeId, "parts": parts],
                      to: userPacksRoot.appendingPathComponent(safe, isDirectory: true).appendingPathComponent("pack.json"))
        return ["id": safe, "packs": listPacksLocked(), "themes": listThemesLocked()]
    }

    func listPacks() -> [[String: Any]] { lock.lock(); defer { lock.unlock() }; return listPacksLocked() }

    /// Installed packs with every file as a URL, and their sounds, cursors and icons resolved.
    private func listPacksLocked() -> [[String: Any]] {
        var result: [[String: Any]] = []
        let folders = ((try? files.contentsOfDirectory(at: userPacksRoot, includingPropertiesForKeys: [.isDirectoryKey])) ?? []).sorted { $0.lastPathComponent < $1.lastPathComponent }
        for folder in folders where !folder.lastPathComponent.hasPrefix(".") {
            guard let info = readJSON(folder.appendingPathComponent("pack.json")) as? [String: Any] else { continue }
            let base = "\(WebViewController.origin)/user-packs/\(Self.encode(folder.lastPathComponent))"
            var urls: [String: String] = [:]
            let root = folder.standardizedFileURL.path
            let enumerator = files.enumerator(at: folder, includingPropertiesForKeys: [.isRegularFileKey])
            while let file = enumerator?.nextObject() as? URL {
                guard (try? file.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true, file.lastPathComponent != "pack.json" else { continue }
                let relative = String(file.standardizedFileURL.path.dropFirst(root.count + 1))
                urls[relative] = "\(base)/\(relative.split(separator: "/").map { Self.encode(String($0)) }.joined(separator: "/"))"
            }
            var sounds: [String: String] = [:]
            for (name, url) in urls { if let match = name.range(of: #"^sounds/[\w-]+\.(wav|mp3|ogg)$"#, options: [.regularExpression, .caseInsensitive]) { _ = match; let file = (name as NSString).lastPathComponent; sounds[(file as NSString).deletingPathExtension.lowercased()] = url } }
            var cursors: [String: Any] = [:]
            for (kind, value) in readJSON(folder.appendingPathComponent("cursors/cursors.json")) as? [String: Any] ?? [:] {
                let spec = value as? [String: Any]; let file = spec?["file"] as? String ?? value as? String ?? ""
                if let url = urls["cursors/\(file)"] { var cursor: [String: Any] = ["url": url]; if let x = spec?["x"] as? Int, let y = spec?["y"] as? Int { cursor["x"] = x; cursor["y"] = y }; cursors[kind] = cursor }
            }
            var icons: [String: String] = [:]
            for (name, file) in readJSON(folder.appendingPathComponent("icons/icons.json")) as? [String: String] ?? [:] { if let url = urls["icons/\(file)"] { icons[name] = url } }
            var wallpapers: [String: String] = [:]
            for (name, url) in urls where name.range(of: #"^wallpapers/[^/]+\.(jpe?g|png|webp)$"#, options: [.regularExpression, .caseInsensitive]) != nil { wallpapers[((name as NSString).lastPathComponent as NSString).deletingPathExtension] = url }
            // A combo's folder has no files: take the sounds, cursors, icons and wallpapers of its parts.
            for part in info["parts"] as? [String] ?? [] {
                let partFolder = userPacksRoot.appendingPathComponent(part, isDirectory: true)
                let partBase = "\(WebViewController.origin)/user-packs/\(Self.encode(part))"
                for file in (try? files.contentsOfDirectory(atPath: partFolder.appendingPathComponent("sounds").path)) ?? [] where file.range(of: #"^[\w-]+\.(wav|mp3|ogg)$"#, options: [.regularExpression, .caseInsensitive]) != nil {
                    sounds[(file as NSString).deletingPathExtension.lowercased()] = "\(partBase)/sounds/\(Self.encode(file))"
                }
                for (kind, value) in readJSON(partFolder.appendingPathComponent("cursors/cursors.json")) as? [String: Any] ?? [:] {
                    let spec = value as? [String: Any]; let file = spec?["file"] as? String ?? value as? String ?? ""
                    guard files.fileExists(atPath: partFolder.appendingPathComponent("cursors/\(file)").path) else { continue }
                    var cursor: [String: Any] = ["url": "\(partBase)/cursors/\(Self.encode(file))"]; if let x = spec?["x"] as? Int, let y = spec?["y"] as? Int { cursor["x"] = x; cursor["y"] = y }; cursors[kind] = cursor
                }
                for file in (try? files.contentsOfDirectory(atPath: partFolder.appendingPathComponent("wallpapers").path)) ?? [] where file.range(of: #"^[^/]+\.(jpe?g|png|webp)$"#, options: [.regularExpression, .caseInsensitive]) != nil {
                    wallpapers[(file as NSString).deletingPathExtension] = "\(partBase)/wallpapers/\(Self.encode(file))"
                }
                for (name, file) in readJSON(partFolder.appendingPathComponent("icons/icons.json")) as? [String: String] ?? [:] where files.fileExists(atPath: partFolder.appendingPathComponent("icons/\(file)").path) { icons[name] = "\(partBase)/icons/\(Self.encode(file))" }
            }
            result.append(["id": folder.lastPathComponent, "catalogId": info["catalogId"] ?? NSNull(), "type": info["type"] ?? "combo", "name": info["name"] ?? folder.lastPathComponent,
                           "author": info["author"] ?? "", "contains": info["contains"] ?? [], "theme": info["theme"] ?? NSNull(), "files": urls, "sounds": sounds, "cursors": cursors, "icons": icons, "wallpapers": wallpapers, "assistant": (Self.assistant(urls) as Any?) ?? NSNull()])
        }
        return result
    }

    /// assistant/agent.json + frames.png + sound<N>.wav of a pack (a Microsoft Agent character).
    private static func assistant(_ urls: [String: String]) -> [String: Any]? {
        guard let json = urls["assistant/agent.json"], let frames = urls["assistant/frames.png"] else { return nil }
        var sounds: [String: String] = [:]
        for (name, url) in urls {
            guard name.range(of: #"^assistant/sound\d+\.(wav|mp3|ogg)$"#, options: [.regularExpression, .caseInsensitive]) != nil else { continue }
            let file = ((name as NSString).lastPathComponent as NSString).deletingPathExtension
            sounds[String(file.dropFirst("sound".count))] = url
        }
        return ["json": json, "frames": frames, "sounds": sounds]
    }

    func removePack(id: String) throws -> [String: Any] {
        let folder = userPacksRoot.appendingPathComponent(id, isDirectory: true).standardizedFileURL
        guard folder.deletingLastPathComponent().path == userPacksRoot.standardizedFileURL.path else { throw ThemeError("Invalid pack.") }
        let info = readJSON(folder.appendingPathComponent("pack.json")) as? [String: Any] ?? [:]
        if let theme = info["theme"] as? String { _ = try? removeTheme(id: theme) }
        lock.lock(); defer { lock.unlock() }
        // A combo takes the items it installed with it.
        for part in info["parts"] as? [String] ?? [] where !part.contains("/") && !part.hasPrefix(".") { try? files.removeItem(at: userPacksRoot.appendingPathComponent(part, isDirectory: true)) }
        try? files.removeItem(at: folder)
        return ["packs": listPacksLocked(), "themes": listThemesLocked()]
    }

    func installCatalogTheme(id: String) throws -> [String: Any] {
        let item = try catalogItem(id)
        let (status, zip) = try Self.download(item["zipUrl"] as? String ?? "")
        guard (200..<300).contains(status) else { throw ThemeError("Unable to download Theme.ZIP (\(status)).") }
        lock.lock(); defer { lock.unlock() }
        let itemId = item["id"] as? String ?? id
        let safe = itemId.replacingOccurrences(of: #"[^a-zA-Z0-9._-]"#, with: "_", options: .regularExpression)
        let destination = userThemesRoot.appendingPathComponent("\(safe)-\(Self.now())", isDirectory: true)
        do {
            try installBundle(zip, destination: destination)
            try writeJSON(["id": itemId], to: destination.appendingPathComponent("catalog-theme.json"))
            return ["id": destination.lastPathComponent, "themes": listThemesLocked()]
        } catch {
            try? files.removeItem(at: destination)
            throw error
        }
    }

    /// Extracts a Theme.ZIP and keeps only what the theme needs, like installCatalogTheme() in main.js.
    private func installBundle(_ zip: Data, destination: URL) throws {
        let temporary = files.temporaryDirectory.appendingPathComponent("theme-\(UUID().uuidString)", isDirectory: true)
        defer { try? files.removeItem(at: temporary) }
        try ZipReader.extract(zip, to: temporary)
        try installThemeFolder(temporary, destination: destination)
    }

    /// Copies the theme found in an extracted folder (Theme.ZIP or the theme/ part of a pack).
    private func installThemeFolder(_ temporary: URL, destination: URL) throws {
        guard let source = findThemeSource(temporary) else { throw ThemeError("Theme.ZIP must contain a .theme, .msstyles, or theme.css file.") }
        try files.createDirectory(at: destination, withIntermediateDirectories: true)
        // A theme.css inside schemes/<scheme>/ belongs to a theme with colour schemes: copy its root.
        let parent = source.deletingLastPathComponent()
        let sourceRoot = parent.deletingLastPathComponent().lastPathComponent == "schemes" ? parent.deletingLastPathComponent().deletingLastPathComponent() : parent
        let copyAll = source.lastPathComponent.lowercased() == "theme.css"
        let enumerator = files.enumerator(at: sourceRoot, includingPropertiesForKeys: [.isRegularFileKey])
        while let file = enumerator?.nextObject() as? URL {
            guard (try? file.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true else { continue }
            if !copyAll && file.lastPathComponent.range(of: #"\.(theme|msstyles|dll|mui)$"#, options: [.regularExpression, .caseInsensitive]) == nil { continue }
            let relative = String(file.standardizedFileURL.path.dropFirst(sourceRoot.standardizedFileURL.path.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            let target = destination.appendingPathComponent(relative)
            try files.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try? files.removeItem(at: target)
            try files.copyItem(at: file, to: target)
        }
    }

    private func findThemeSource(_ root: URL) -> URL? {
        let entries = ((try? files.contentsOfDirectory(at: root, includingPropertiesForKeys: [.isDirectoryKey])) ?? []).sorted { $0.lastPathComponent < $1.lastPathComponent }
        for entry in entries {
            if (try? entry.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true {
                if let found = findThemeSource(entry) { return found }
                continue
            }
            let name = entry.lastPathComponent.lowercased()
            if name.hasSuffix(".theme") || name.hasSuffix(".msstyles") || name == "theme.css" { return entry }
        }
        return nil
    }

    // MARK: - Helpers

    private static func encode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? value
    }

    private func readJSON(_ url: URL) -> Any? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    private func writeJSON(_ value: Any, to url: URL) throws {
        try files.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: value).write(to: url)
    }

    static func download(_ url: String) throws -> (Int, Data) {
        guard let target = URL(string: url) else { throw ThemeError("Invalid URL: \(url)") }
        var request = URLRequest(url: target)
        request.timeoutInterval = 30
        let semaphore = DispatchSemaphore(value: 0)
        var result: Result<(Int, Data), Error> = .failure(ThemeError("Download failed"))
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error { result = .failure(error) }
            else { result = .success(((response as? HTTPURLResponse)?.statusCode ?? 0, data ?? Data())) }
            semaphore.signal()
        }.resume()
        semaphore.wait()
        return try result.get()
    }
}
