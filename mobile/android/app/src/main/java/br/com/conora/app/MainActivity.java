package br.com.conora.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    lockWebViewZoom();
  }

  @Override
  public void onStart() {
    super.onStart();
    lockWebViewZoom();
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

