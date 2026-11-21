package br.com.conora.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(ConoraMetaSdkPlugin.class);
    super.onCreate(savedInstanceState);
    startMetaSdk();
    lockWebViewZoom();
  }

  @Override
  public void onStart() {
    super.onStart();
    lockWebViewZoom();
  }

  @Override
  public void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);

    if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
        && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
      PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
      if (pluginHandle == null) {
        Log.i("Google Activity Result", "SocialLogin login handle is null");
        return;
      }
      Plugin plugin = pluginHandle.getInstance();
      if (!(plugin instanceof SocialLoginPlugin)) {
        Log.i("Google Activity Result", "SocialLogin plugin instance is not SocialLoginPlugin");
        return;
      }
      ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
    }
  }

  @Override
  public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
    // Required by Capgo SocialLogin (Credential Manager / Google).
  }

  /**
   * Starts the Meta SDK so installs and app activations reach Meta Ads.
   * FacebookInitProvider normally does this; this call keeps it working even if a
   * dependency removes that provider again. Builds without a client token skip it.
   */
  private void startMetaSdk() {
    try {
      if (getString(R.string.facebook_client_token).trim().isEmpty()) {
        return;
      }
      if (!FacebookSdk.isInitialized()) {
        FacebookSdk.sdkInitialize(getApplicationContext());
      }
      AppEventsLogger.activateApp(getApplication());
    } catch (RuntimeException e) {
      Log.w("ConoraMetaSdk", "Meta SDK not started", e);
    }
  }

  private void lockWebViewZoom() {
    if (getBridge() == null) {
      return;
    }
    WebView webView = getBridge().getWebView();
    if (webView == null) {
      return;
    }
    WebSettings settings = webView.getSettings();
    settings.setSupportZoom(false);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setTextZoom(100);
  }
}
