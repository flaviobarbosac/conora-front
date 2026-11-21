package br.com.conora.app;

import android.os.Bundle;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Iterator;

/**
 * Android counterpart of the iOS ConoraMetaSdk plugin: logs funnel App Events through the Meta SDK.
 * The SDK itself starts from the manifest (AutoInitEnabled), only when the client token is present.
 */
@CapacitorPlugin(name = "ConoraMetaSdk")
public class ConoraMetaSdkPlugin extends Plugin {
  private AppEventsLogger logger;

  /** Logs one App Event. Params accept strings and numbers only; never send PII. */
  @PluginMethod
  public void logEvent(PluginCall call) {
    String name = call.getString("name", "");
    name = name == null ? "" : name.trim();
    if (name.isEmpty()) {
      call.reject("name is required");
      return;
    }

    JSObject result = new JSObject();
    if (!FacebookSdk.isInitialized()) {
      // Builds without META_CLIENT_TOKEN keep the SDK off.
      result.put("logged", false);
      call.resolve(result);
      return;
    }

    Bundle parameters = new Bundle();
    JSObject params = call.getObject("params", new JSObject());
    if (params != null) {
      Iterator<String> keys = params.keys();
      while (keys.hasNext()) {
        String key = keys.next();
        Object value = params.opt(key);
        if (value instanceof String) {
          parameters.putString(key, (String) value);
        } else if (value instanceof Integer || value instanceof Long) {
          parameters.putLong(key, ((Number) value).longValue());
        } else if (value instanceof Number) {
          parameters.putDouble(key, ((Number) value).doubleValue());
        }
      }
    }

    if (logger == null) {
      logger = AppEventsLogger.newLogger(getContext());
    }
    Double valueToSum = call.getDouble("valueToSum");
    if (valueToSum != null) {
      logger.logEvent(name, valueToSum, parameters);
    } else {
      logger.logEvent(name, parameters);
    }
    result.put("logged", true);
    call.resolve(result);
  }
}
