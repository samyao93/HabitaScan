package ca.habitascan.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/* Activité principale. Reçoit aussi les annonces partagées depuis Facebook, Kijiji, la galerie…
   (menu « Partager » > HabitaScan) et les passe à l'app web par le module PartagePlugin. */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PartagePlugin.class);
        super.onCreate(savedInstanceState);
        PartagePlugin.recevoir(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        PartagePlugin.recevoir(this, intent);
    }
}
