package app.lifeos.android;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

/**
 * LifeOS runs its web app inside Capacitor's WebView.
 * - Creates the alarm notification channel with alarm audio, so alarms ring on vibrate/silent
 *   and through Do Not Disturb (the notifications plugin can only create notification-audio channels).
 * - Forwards the "allow access to Google Drive" consent result to the Google sign-in plugin.
 */
public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {

    static final String ALARM_CHANNEL_ID = "lifeos_alarm_clock";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        createAlarmChannel();
        super.onCreate(savedInstanceState);
    }

    private void createAlarmChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(ALARM_CHANNEL_ID) != null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(ALARM_CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Wake-up and other alarms");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 600, 400, 600, 400, 600 });
        channel.enableLights(true);
        channel.setBypassDnd(true);
        Uri sound = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/lifeos_alarm");
        AudioAttributes audio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, audio);
        manager.createNotificationChannel(channel);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN || requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            return;
        }
        PluginHandle handle = getBridge().getPlugin("SocialLogin");
        if (handle == null) {
            return;
        }
        Plugin plugin = handle.getInstance();
        if (plugin instanceof SocialLoginPlugin) {
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
