package com.dogbank.dogbank_flutter

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "dogbank.app/session")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "closeApp" -> {
                        finishAndRemoveTask()
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
