package dev.kamika.nekochat_reloaded

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Installs an update found by nekochat.js: downloads the release APK from GitHub and opens the
 * system installer. Android lets only app stores install silently, so the user confirms it there.
 */
object Updater {
    private const val RELEASES = "https://github.com/xKaMikax/nekochat_reloaded/releases/download/"

    fun install(activity: MainActivity, url: String): JSONObject {
        require(url.startsWith(RELEASES) && url.endsWith(".apk", true)) { "Invalid update address." }
        // Android 8+: installing needs "Install unknown apps" for this app, asked for once.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
            activity.runOnUiThread {
                activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
            }
            return JSONObject().put("state", "permission")
        }
        val folder = File(activity.cacheDir, "updates").apply { mkdirs() }
        folder.listFiles()?.forEach { it.delete() }
        val target = File(folder, "nekochat-reloaded-update.apk")
        var address = URL(url)
        // GitHub answers with a redirect to its download host; follow it by hand (HTTPS only).
        repeat(5) {
            val connection = address.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 15000; connection.readTimeout = 30000
            when (connection.responseCode) {
                in 300..399 -> {
                    val next = URL(address, connection.getHeaderField("Location") ?: throw IllegalStateException("Broken redirect."))
                    require(next.protocol == "https") { "Insecure update address." }
                    connection.disconnect(); address = next
                }
                HttpURLConnection.HTTP_OK -> {
                    connection.inputStream.use { input -> target.outputStream().use { input.copyTo(it) } }
                    connection.disconnect()
                    val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.updates", target)
                    activity.runOnUiThread {
                        activity.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
                    }
                    return JSONObject().put("state", "installer").put("mode", "installer")
                }
                else -> throw IllegalStateException("The download failed (${connection.responseCode}).")
            }
        }
        throw IllegalStateException("Too many redirects.")
    }
}
