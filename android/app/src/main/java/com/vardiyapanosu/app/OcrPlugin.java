package com.vardiyapanosu.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Telefonun kendi metin tanıması (Google ML Kit, cihazda çalışır, internet gerekmez).
 * Vardiya listesi görselini tek seferde okur; her kelimeyi ve harfi konumuyla birlikte döndürür.
 * Tarayıcı içindeki okuma motoruna göre çok daha hızlıdır.
 */
@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

    private TextRecognizer recognizer;

    private TextRecognizer recognizer() {
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        return recognizer;
    }

    @PluginMethod
    public void recognize(PluginCall call) {
        String data = call.getString("image");
        if (data == null || data.isEmpty()) {
            call.reject("Görsel verisi yok");
            return;
        }
        int comma = data.indexOf(',');
        if (data.startsWith("data:") && comma > 0) data = data.substring(comma + 1);
        Bitmap bitmap;
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException e) {
            call.reject("Görsel çözülemedi");
            return;
        }
        if (bitmap == null) {
            call.reject("Görsel açılamadı");
            return;
        }
        final int width = bitmap.getWidth();
        final int height = bitmap.getHeight();
        final long started = System.currentTimeMillis();
        recognizer()
            .process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener(text -> {
                JSArray lines = new JSArray();
                for (Text.TextBlock block : text.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        JSArray elements = new JSArray();
                        for (Text.Element element : line.getElements()) {
                            JSArray symbols = new JSArray();
                            for (Text.Symbol symbol : element.getSymbols()) {
                                JSObject s = new JSObject();
                                s.put("t", symbol.getText());
                                s.put("b", box(symbol.getBoundingBox()));
                                symbols.put(s);
                            }
                            JSObject e = new JSObject();
                            e.put("t", element.getText());
                            e.put("b", box(element.getBoundingBox()));
                            e.put("c", element.getConfidence());
                            e.put("s", symbols);
                            elements.put(e);
                        }
                        JSObject l = new JSObject();
                        l.put("t", line.getText());
                        l.put("b", box(line.getBoundingBox()));
                        l.put("e", elements);
                        lines.put(l);
                    }
                }
                JSObject result = new JSObject();
                result.put("width", width);
                result.put("height", height);
                result.put("ms", System.currentTimeMillis() - started);
                result.put("lines", lines);
                call.resolve(result);
            })
            .addOnFailureListener(e -> call.reject("Metin tanıma hatası: " + e.getMessage()));
    }

    private static JSArray box(Rect r) {
        JSArray a = new JSArray();
        if (r == null) return a;
        a.put(r.left);
        a.put(r.top);
        a.put(r.right);
        a.put(r.bottom);
        return a;
    }
}
