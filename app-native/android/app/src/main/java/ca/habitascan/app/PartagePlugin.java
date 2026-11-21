package ca.habitascan.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

/*
 * Module « Partage », appelé par l'app web (src/natif.js, src/partage.js) :
 * - reçoit ce qui est partagé vers HabitaScan (texte, lien ou image) : lire() au démarrage, événement « partage » ensuite ;
 * - partagerImage() ouvre la feuille de partage d'Android avec la carte du verdict.
 */
@CapacitorPlugin(name = "Partage")
public class PartagePlugin extends Plugin {

    private static final int COTE_MAX = 1600; // les captures sont réduites avant d'être passées à l'app web
    private static JSObject enAttente = null;
    private static PartagePlugin instance = null;

    @Override
    public void load() {
        instance = this;
    }

    /** Lit un partage reçu par l'activité. Ne fait rien si l'intention n'est pas un partage. */
    static void recevoir(Context ctx, Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        JSObject d = new JSObject();
        String sujet = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        String texte = intent.getStringExtra(Intent.EXTRA_TEXT);
        StringBuilder t = new StringBuilder();
        if (sujet != null && !sujet.isEmpty()) t.append(sujet);
        if (texte != null && !texte.isEmpty()) {
            if (t.length() > 0) t.append("\n");
            t.append(texte);
        }
        if (t.length() > 0) d.put("texte", t.toString());
        String type = intent.getType();
        if (type != null && type.startsWith("image/")) {
            Uri uri = flux(intent);
            String image = uri == null ? null : imageEnBase64(ctx, uri);
            if (image != null) d.put("image", image);
        }
        if (!d.has("texte") && !d.has("image")) return;
        intent.setAction(Intent.ACTION_MAIN); // ne pas relire le même partage au prochain démarrage
        if (instance != null && instance.hasListeners("partage")) instance.notifyListeners("partage", d);
        else enAttente = d;
    }

    @SuppressWarnings("deprecation")
    private static Uri flux(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
        return intent.getParcelableExtra(Intent.EXTRA_STREAM);
    }

    /** Image partagée → JPEG réduit, en base64. */
    private static String imageEnBase64(Context ctx, Uri uri) {
        try (InputStream in = ctx.getContentResolver().openInputStream(uri)) {
            Bitmap b = BitmapFactory.decodeStream(in);
            if (b == null) return null;
            float k = Math.min(1f, (float) COTE_MAX / Math.max(b.getWidth(), b.getHeight()));
            if (k < 1f) b = Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * k), Math.round(b.getHeight() * k), true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            b.compress(Bitmap.CompressFormat.JPEG, 85, out);
            return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    /** Partage reçu avant que l'app web soit prête (ou null). */
    @PluginMethod
    public void lire(PluginCall call) {
        JSObject d = enAttente;
        enAttente = null;
        call.resolve(d == null ? new JSObject() : d);
    }

    /** Ouvre la feuille de partage avec une image PNG ({ image: base64, texte }). */
    @PluginMethod
    public void partagerImage(PluginCall call) {
        String image = call.getString("image");
        if (image == null) {
            call.reject("image manquante");
            return;
        }
        try {
            File f = new File(getContext().getCacheDir(), "habitascan-verdict.png");
            try (FileOutputStream out = new FileOutputStream(f)) {
                out.write(Base64.decode(image, Base64.DEFAULT));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent envoi = new Intent(Intent.ACTION_SEND);
            envoi.setType("image/png");
            envoi.putExtra(Intent.EXTRA_STREAM, uri);
            String texte = call.getString("texte");
            if (texte != null) envoi.putExtra(Intent.EXTRA_TEXT, texte);
            envoi.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent choix = Intent.createChooser(envoi, null);
            choix.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(choix);
            call.resolve();
        } catch (Exception e) {
            call.reject("partage impossible", e);
        }
    }
}
