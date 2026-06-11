package expo.modules.kairosliveactivity

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android mirror of the iOS Live Activity: a single ongoing notification that
// tracks the current exercise / set and counts the rest down with a
// chronometer. Action buttons broadcast to WorkoutActionReceiver which loops
// the action back to JS through the `onWidgetAction` event.
//
// NOTE: this is an app-posted ongoing notification, not a foreground Service.
// It survives backgrounding for as long as the process lives, which covers
// the in-workout use case; promoting it to a true foreground service (for
// process-death survival) is documented in docs/LIVE_ACTIVITY_SETUP.md.
class KairosLiveActivityModule : Module() {
  companion object {
    const val CHANNEL_ID = "kairos_workout"
    const val NOTIFICATION_ID = 4217
    const val ACTION_BROADCAST = "expo.modules.kairosliveactivity.WIDGET_ACTION"
    const val EXTRA_ACTION = "action"
  }

  private var receiver: BroadcastReceiver? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("KairosLiveActivity")

    Events("onWidgetAction")

    OnCreate {
      ensureChannel()
      val r = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
          val action = intent?.getStringExtra(EXTRA_ACTION) ?: return
          sendEvent("onWidgetAction", mapOf("action" to action))
        }
      }
      receiver = r
      ContextCompat.registerReceiver(
        context,
        r,
        IntentFilter(ACTION_BROADCAST),
        ContextCompat.RECEIVER_NOT_EXPORTED,
      )
    }

    OnDestroy {
      receiver?.let { runCatching { context.unregisterReceiver(it) } }
      receiver = null
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }

    Function("isSupported") {
      NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    AsyncFunction("startActivity") { state: Map<String, Any?> ->
      postNotification(state)
    }

    AsyncFunction("updateActivity") { state: Map<String, Any?> ->
      postNotification(state)
    }

    AsyncFunction("endActivity") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Entrenamiento en curso",
      NotificationManager.IMPORTANCE_LOW, // silent — this is a status surface, not an alert
    ).apply {
      description = "Estado del entrenamiento activo y descanso"
      setShowBadge(false)
    }
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(channel)
  }

  private fun actionIntent(action: String, requestCode: Int): PendingIntent {
    val intent = Intent(ACTION_BROADCAST)
      .setPackage(context.packageName)
      .putExtra(EXTRA_ACTION, action)
    return PendingIntent.getBroadcast(
      context,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun postNotification(state: Map<String, Any?>) {
    val exerciseName = state["exerciseName"] as? String ?: ""
    val setIndex = (state["setIndex"] as? Number)?.toInt() ?: 1
    val setTotal = (state["setTotal"] as? Number)?.toInt() ?: 1
    val targetWeight = (state["targetWeight"] as? Number)?.toDouble()
    val targetReps = (state["targetReps"] as? Number)?.toInt()
    val restEndsAt = (state["restEndsAt"] as? Number)?.toLong()

    val target = buildString {
      if (targetWeight != null) append("${trim(targetWeight)} kg")
      if (targetReps != null) {
        if (isNotEmpty()) append(" × ")
        append("$targetReps")
      }
    }

    val resting = restEndsAt != null && restEndsAt > System.currentTimeMillis()
    val title = if (resting) "Descanso · $exerciseName" else exerciseName
    val text = buildString {
      append("Serie $setIndex de $setTotal")
      if (target.isNotEmpty()) append(" · $target")
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(0, "Completar serie", actionIntent("completeSet", 1))

    if (resting && restEndsAt != null) {
      builder
        .setWhen(restEndsAt)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .addAction(0, "+30 s", actionIntent("extendRest", 2))
    }

    // POST_NOTIFICATIONS may be denied on 13+; posting then throws a
    // SecurityException — treat as a silent no-op like iOS does.
    runCatching { NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build()) }
  }

  private fun trim(value: Double): String =
    if (value % 1.0 == 0.0) value.toInt().toString() else value.toString()
}

// Loops notification action taps back into the module's event stream. The
// module registers a runtime receiver for the same intent action; this
// manifest receiver exists so taps still resolve when the runtime receiver
// is gone (e.g. process recreated) — it simply re-broadcasts internally.
class WorkoutActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    if (context == null || intent == null) return
    val forwarded = Intent(KairosLiveActivityModule.ACTION_BROADCAST)
      .setPackage(context.packageName)
      .putExtras(intent)
    context.sendBroadcast(forwarded)
  }
}
