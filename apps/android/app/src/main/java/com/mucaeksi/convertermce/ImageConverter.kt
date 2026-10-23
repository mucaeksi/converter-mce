package com.mucaeksi.convertermce

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageDecoder
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.roundToInt

@Suppress("DEPRECATION")
enum class ImageOutput(val mime: String, val extension: String, val encoding: Bitmap.CompressFormat) {
    JPEG("image/jpeg", "jpg", Bitmap.CompressFormat.JPEG),
    PNG("image/png", "png", Bitmap.CompressFormat.PNG),
    WEBP("image/webp", "webp", Bitmap.CompressFormat.WEBP)
}
data class ConvertedImage(val bytes: ByteArray, val width: Int, val height: Int, val format: ImageOutput)

object ImageConverter {
    const val MAX_INPUT_BYTES = 10 * 1024 * 1024
    const val MAX_PIXELS = 8_000_000L

    fun readInput(stream: InputStream): ByteArray = ByteArrayOutputStream().use { output ->
        val buffer = ByteArray(8192)
        while (true) {
            val count = stream.read(buffer)
            if (count == -1) break
            require(output.size() + count <= MAX_INPUT_BYTES) { "Dosya 10 MB sınırını aşıyor." }
            output.write(buffer, 0, count)
        }
        output.toByteArray()
    }

    fun dimensions(width: Int, height: Int, maxWidth: Int?): Pair<Int, Int> {
        require(width > 0 && height > 0 && width.toLong() * height <= MAX_PIXELS) { "Görüntü en fazla 8 megapiksel olabilir." }
        require(maxWidth == null || maxWidth in 1..4096) { "Genişlik 1–4096 arasında olmalı." }
        val scale = if (maxWidth == null) 1.0 else minOf(1.0, maxWidth.toDouble() / width)
        return maxOf(1, (width * scale).roundToInt()) to maxOf(1, (height * scale).roundToInt())
    }

    fun convert(input: ByteArray, quality: Int = 85, maxWidth: Int? = null, format: ImageOutput = ImageOutput.JPEG): ConvertedImage {
        require(input.isNotEmpty() && input.size <= MAX_INPUT_BYTES) { "Dosya boş veya 10 MB sınırını aşıyor." }
        require(quality in 10..95) { "Kalite 10–95 arasında olmalı." }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(input, 0, input.size, bounds)
        require(bounds.outMimeType in listOf("image/png", "image/jpeg", "image/webp", "image/bmp")) { "PNG, JPEG, WebP veya BMP seçin." }
        dimensions(bounds.outWidth, bounds.outHeight, maxWidth)
        if (bounds.outMimeType == "image/webp") {
            val view = ByteBuffer.wrap(input).order(ByteOrder.LITTLE_ENDIAN)
            var offset = 12
            while (offset + 8 <= input.size) {
                val length = view.getInt(offset + 4).toLong() and 0xffffffffL
                val chunk = String(input, offset, 4, Charsets.US_ASCII)
                require(offset.toLong() + 8 + length <= input.size) { "WebP parçası eksik." }
                require(chunk != "ANIM" && chunk != "ANMF" && !(chunk == "VP8X" && length >= 10 && (input[offset + 8].toInt() and 2) != 0)) { "Animasyonlu WebP desteklenmiyor." }
                offset += 8 + length.toInt() + (length.toInt() and 1)
            }
        }
        if (bounds.outMimeType == "image/png") {
            val view = ByteBuffer.wrap(input)
            var offset = 8
            while (offset + 12 <= input.size) {
                val length = view.getInt(offset).toLong() and 0xffffffffL
                val chunk = String(input, offset + 4, 4, Charsets.US_ASCII)
                require(chunk != "acTL") { "Animasyonlu PNG bu sürümde desteklenmiyor." }
                if (chunk == "IDAT" || offset.toLong() + length + 12 > input.size) break
                offset += length.toInt() + 12
            }
        }
        val decoded = ImageDecoder.decodeBitmap(ImageDecoder.createSource(ByteBuffer.wrap(input))) { decoder, info, _ ->
            val size = dimensions(info.size.width, info.size.height, maxWidth)
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.setTargetSize(size.first, size.second)
        }
        try {
            val output = Bitmap.createBitmap(decoded.width, decoded.height, Bitmap.Config.ARGB_8888)
            try {
                Canvas(output).apply {
                    if (format == ImageOutput.JPEG) drawColor(Color.WHITE)
                    drawBitmap(decoded, 0f, 0f, null)
                }
                val bytes = ByteArrayOutputStream().use { stream ->
                    check(output.compress(format.encoding, quality, stream)) { "Çıktı oluşturulamadı." }
                    stream.toByteArray()
                }
                return ConvertedImage(bytes, output.width, output.height, format)
            } finally { output.recycle() }
        } finally { decoded.recycle() }
    }
}
