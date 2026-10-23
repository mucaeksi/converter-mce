package com.mucaeksi.convertermce

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private data class PdfSource(val uri: Uri, val name: String)

@Composable
fun PdfWorkspace(resolver: ContentResolver, onBusyChange: (Boolean) -> Unit) {
    var sources by remember { mutableStateOf<List<PdfSource>>(emptyList()) }
    var result by remember { mutableStateOf<ConvertedPdf?>(null) }
    var maxWidth by remember { mutableStateOf("2048") }
    var message by remember { mutableStateOf("Görsellerinizi seçin. Her görsel ayrı bir A4 sayfası olur.") }
    var busy by remember { mutableStateOf(false) }
    var task by remember { mutableStateOf<Job?>(null) }
    val scope = rememberCoroutineScope()
    fun markBusy(value: Boolean) { busy = value; onBusyChange(value) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        result = null
        if (uris.isNotEmpty()) {
            sources = emptyList()
            if (uris.size > 8) message = "En fazla 8 görsel seçin."
            else task = scope.launch {
                markBusy(true)
                try {
                    sources = withContext(Dispatchers.IO) {
                        uris.mapIndexed { index, uri ->
                            ensureActive()
                            val name = runCatching {
                                resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                                    if (cursor.moveToFirst()) cursor.getString(0) else null
                                }
                            }.getOrNull()?.take(200) ?: "Görsel ${index + 1}"
                            PdfSource(uri, name)
                        }
                    }
                    message = "Sayfa sırasını ayarlayın ve PDF oluşturun."
                } catch (_: CancellationException) { message = "İşlem durduruldu." }
                catch (_: Exception) { message = "Görseller seçilemedi. Yeniden deneyin." }
                finally { markBusy(false) }
            }
        }
    }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        val pdf = result
        if (uri != null && pdf != null) task = scope.launch {
            markBusy(true)
            try {
                withContext(Dispatchers.IO) {
                    val stream = resolver.openOutputStream(uri) ?: error("Kayıt konumu açılamadı.")
                    stream.use { it.write(pdf.bytes) }
                }
                message = "PDF kaydedildi. Görselleriniz cihazınızda kaldı."
            } catch (_: CancellationException) { message = "Kaydetme durduruldu; seçtiğiniz konumu kontrol edin." }
            catch (_: Exception) { message = "PDF kaydedilemedi. Başka bir konum deneyin." }
            finally { markBusy(false) }
        }
    }
    fun move(index: Int, delta: Int) {
        val next = sources.toMutableList()
        val source = next.removeAt(index)
        next.add(index + delta, source)
        sources = next; result = null
    }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Görsellerinden\nPDF oluştur.", fontSize = 32.sp, lineHeight = 38.sp)
        Text("Ücretsiz · Çevrimdışı · PNG, JPEG, WebP, BMP", style = MaterialTheme.typography.bodySmall)
        Text("1–8 görsel · Dosya başına 10 MB / 8 MP · Toplam 20 MB · İşlenen görüntüler toplam en fazla 16 MP", style = MaterialTheme.typography.bodySmall)
        OutlinedButton(enabled = !busy, onClick = { picker.launch(arrayOf("image/png", "image/jpeg", "image/webp", "image/bmp")) }) { Text("Görselleri seç") }
        sources.forEachIndexed { index, source ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("${index + 1}. ${source.name}", modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                IconButton(enabled = !busy && index > 0, onClick = { move(index, -1) }, modifier = Modifier.semantics { contentDescription = "${source.name} yukarı taşı" }) { Text("↑") }
                IconButton(enabled = !busy && index < sources.lastIndex, onClick = { move(index, 1) }, modifier = Modifier.semantics { contentDescription = "${source.name} aşağı taşı" }) { Text("↓") }
                IconButton(enabled = !busy, onClick = { sources = sources.filterIndexed { item, _ -> item != index }; result = null }, modifier = Modifier.semantics { contentDescription = "${source.name} kaldır" }) { Text("×") }
            }
        }
        OutlinedTextField(value = maxWidth, onValueChange = { maxWidth = it; result = null }, label = { Text("En fazla görsel genişliği (px)") }, supportingText = { Text("2048 piksel daha az bellek kullanır. Orijinal boyut için boş bırakın. 1–4096 px.") }, singleLine = true, enabled = !busy)
        Text("Sayfalar otomatik dikey/yatay A4 olur; görüntü oranı korunur. Saydam alanlar beyaz görünür. Orijinaller değiştirilmez. Animasyonlu WebP desteklenmez.", style = MaterialTheme.typography.bodySmall)
        Button(modifier = Modifier.fillMaxWidth(), enabled = !busy && sources.isNotEmpty(), onClick = {
            task = scope.launch {
                markBusy(true); result = null; message = "PDF cihazınızda oluşturuluyor…"
                try {
                    val width = if (maxWidth.isBlank()) null else maxWidth.toIntOrNull() ?: error("Geçerli bir genişlik girin.")
                    require(width == null || width in 1..4096) { "Genişlik 1–4096 arasında olmalı." }
                    val images = withContext(Dispatchers.IO) {
                        var total = 0L
                        sources.map { source ->
                            ensureActive()
                            val bytes = (resolver.openInputStream(source.uri) ?: error("Görsel açılamadı.")).use { ImageConverter.readInput(it) }
                            total += bytes.size
                            require(total <= ImagePdfConverter.MAX_TOTAL_BYTES) { "Toplam dosya boyutu en fazla 20 MB olabilir." }
                            bytes
                        }
                    }
                    result = withContext(Dispatchers.Default) { ImagePdfConverter.convert(images, width) { coroutineContext.ensureActive() } }
                    message = "Hazır: ${result!!.pages} sayfa · ${result!!.bytes.size / 1024} KB"
                } catch (_: CancellationException) { message = "İşlem durduruldu." }
                catch (e: Exception) { message = e.message ?: "PDF oluşturulamadı." }
                finally { markBusy(false) }
            }
        }) { Text(if (busy) "İşleniyor…" else "PDF oluştur →") }
        Text(message)
        if (busy) TextButton(onClick = { task?.cancel() }) { Text("İşlemi durdur") }
        if (result != null) Button(enabled = !busy, modifier = Modifier.fillMaxWidth(), onClick = { save.launch("converter-mce.pdf") }) { Text("PDF dosyasını kaydet ↓") }
        Text("PDF yalnızca cihazınızda oluşturulur. Dosya yüklenmez; reklam ve bulut işlemleri etkin değildir.", style = MaterialTheme.typography.bodySmall)
    }
}
