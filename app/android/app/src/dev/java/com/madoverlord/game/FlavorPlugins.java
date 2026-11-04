package com.madoverlord.game;

import com.getcapacitor.BridgeActivity;

final class FlavorPlugins {
    static void register(BridgeActivity activity) {
        activity.registerPlugin(AppUpdatePlugin.class);
    }
}
