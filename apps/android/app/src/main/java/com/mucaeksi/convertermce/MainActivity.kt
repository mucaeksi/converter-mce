package com.mucaeksi.convertermce

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFF174E43), background = Color(0xFFF7F8F5))) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { Converter() }
            }
        }
    }

    @Composable
    private fun Converter() {
        var selected by remember { mutableStateOf<Uri?>(null) }
        var quality by remember { mutableFloatStateOf(85f) }
        var format by remember { mutableStateOf(ImageOutput.JPEG) }
        var maxWidth by remember { mutableStateOf("") }
        var result by remember { mutableStateOf<ConvertedImage?>(null) }
        var message by remember { mutableStateOf("PNG, JPEG, WebP veya BMP seçerek başlayın.") }
        var busy by remember { mutableStateOf(false) }
        val scope = rememberCoroutineScope()
        val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) { selected = uri; result = null; message = "Dosya seçildi. Cihazınızda dönüştürmeye hazır." }
        }
        val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument(result?.format?.mime ?: format.mime)) { uri ->
            val converted = result
            if (uri != null && converted != null) scope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        val stream = contentResolver.openOutputStream(uri) ?: error("Dosya açılamadı.")
                        stream.use { it.write(converted.bytes) }
                    }
                    message = "Dosya kaydedildi."
                } catch (_: Exception) { message = "Dosya kaydedilemedi. Başka bir konum deneyin." }
            }
        }
        Column(Modifier.safeDrawingPadding().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            Text("↔  converter mce", fontSize = 24.sp, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(12.dp))
            Text("Dosyana yeni\nbir biçim ver.", fontSize = 36.sp, lineHeight = 42.sp)
            Text("Ücretsiz · Cihazda işleme · İnternet gerekmez", style = MaterialTheme.typography.bodySmall)
            Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text("01  Dosyanı seç", style = MaterialTheme.typography.titleMedium)
                    Text("PNG / JPEG / WebP / BMP → JPG, PNG, WebP\nEn fazla 10 MB ve 8 megapiksel", style = MaterialTheme.typography.bodySmall)
                    OutlinedButton(onClick = { picker.launch(arrayOf("image/png", "image/jpeg", "image/webp", "image/bmp")) }, enabled = !busy) { Text(if (selected == null) "Dosya seç" else "Dosyayı değiştir") }
                    Text("02  Çıktını ayarla", style = MaterialTheme.typography.titleMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ImageOutput.entries.forEach { option ->
                            FilterChip(selected = format == option, onClick = { format = option; result = null }, label = { Text(option.name) }, enabled = !busy)
                        }
                    }
                    Text(if (format == ImageOutput.PNG) "PNG · Kayıpsız" else "Görüntü kalitesi: ${quality.toInt()}%")
                    Slider(value = quality, onValueChange = { quality = it; result = null }, valueRange = 10f..95f, enabled = !busy && format != ImageOutput.PNG)
                    OutlinedTextField(value = maxWidth, onValueChange = { maxWidth = it; result = null }, label = { Text("En fazla genişlik (isteğe bağlı)") }, suffix = { Text("px") }, singleLine = true, enabled = !busy)
                    Text("En-boy oranı korunur. JPEG saydam alanları beyaz yapar; PNG ve WebP saydamlığı korur. Kaynak metadata kaldırılır.", style = MaterialTheme.typography.bodySmall)
                    Button(modifier = Modifier.fillMaxWidth(), enabled = selected != null && !busy, onClick = {
                        scope.launch {
                            busy = true; result = null; message = "Cihazınızda dönüştürülüyor…"
                            try {
                                val width = if (maxWidth.isBlank()) null else maxWidth.toIntOrNull() ?: error("Geçerli bir genişlik girin.")
                                val bytes = withContext(Dispatchers.IO) {
                                    val stream = contentResolver.openInputStream(selected!!) ?: error("Dosya açılamadı.")
                                    stream.use { ImageConverter.readInput(it) }
                                }
                                result = withContext(Dispatchers.Default) { ImageConverter.convert(bytes, quality.toInt(), width, format) }
                                message = "Hazır: ${result!!.width} × ${result!!.height} px · ${result!!.bytes.size / 1024} KB"
                            } catch (e: Exception) { message = e.message ?: "Görüntü açılamadı." }
                            finally { busy = false }
                        }
                    }) { Text(if (busy) "İşleniyor…" else "Dönüştür →") }
                }
            }
            Text(message, style = MaterialTheme.typography.bodyMedium)
            if (result != null) Button(onClick = { save.launch("converter-mce.${result!!.format.extension}") }, modifier = Modifier.fillMaxWidth()) { Text("${result!!.format.name} dosyasını kaydet ↓") }
            Spacer(Modifier.height(12.dp))
            Text("Dosyalarınız cihazınızda kalır. Bu geliştirme sürümünde reklam ve bulut yüklemesi etkin değildir.", style = MaterialTheme.typography.bodySmall)
        }
    }
}
