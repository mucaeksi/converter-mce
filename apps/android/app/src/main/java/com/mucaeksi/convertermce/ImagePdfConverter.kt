package com.mucaeksi.convertermce

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import java.io.ByteArrayOutputStream
import java.io.OutputStream

data class ConvertedPdf(val bytes: ByteArray, val pages: Int)
internal data class PdfPlacement(val pageWidth: Int, val pageHeight: Int, val left: Float, val top: Float, val right: Float, val bottom: Float)

object ImagePdfConverter {
    const val MAX_TOTAL_BYTES = 20 * 1024 * 1024
    private const val MAX_OUTPUT_BYTES = 30 * 1024 * 1024

    internal fun placement(width: Int, height: Int): PdfPlacement {
        ImageConverter.dimensions(width, height, null)
        val pageWidth = if (width > height) 842 else 595
        val pageHeight = if (width > height) 595 else 842
        val scale = minOf((pageWidth - 48f) / width, (pageHeight - 48f) / height)
        val w = width * scale
        val h = height * scale
        return PdfPlacement(pageWidth, pageHeight, (pageWidth - w) / 2, (pageHeight - h) / 2, (pageWidth + w) / 2, (pageHeight + h) / 2)
    }

    fun convert(inputs: List<ByteArray>, maxWidth: Int? = 2048, checkCancelled: () -> Unit = {}): ConvertedPdf {
        require(inputs.isNotEmpty() && inputs.size <= 8) { "1–8 görsel seçin." }
        require(inputs.sumOf { it.size.toLong() } <= MAX_TOTAL_BYTES) { "Toplam dosya boyutu en fazla 20 MB olabilir." }
        require(maxWidth == null || maxWidth in 1..4096) { "Genişlik 1–4096 arasında olmalı." }
        val document = PdfDocument()
        val decoded = mutableListOf<Bitmap>()
        try {
            var pixels = 0L
            inputs.forEachIndexed { index, input ->
                checkCancelled()
                val bitmap = ImageConverter.decode(input, maxWidth)
                decoded.add(bitmap)
                pixels += bitmap.width.toLong() * bitmap.height
                require(pixels <= 16_000_000L) { "İşlenen görsellerin toplamı en fazla 16 megapiksel olabilir." }
                val layout = placement(bitmap.width, bitmap.height)
                val page = document.startPage(PdfDocument.PageInfo.Builder(layout.pageWidth, layout.pageHeight, index + 1).create())
                try {
                    page.canvas.drawColor(Color.WHITE)
                    page.canvas.drawBitmap(bitmap, null, RectF(layout.left, layout.top, layout.right, layout.bottom), Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
                } finally { document.finishPage(page) }
            }
            checkCancelled()
            val bytes = ByteArrayOutputStream().use { buffer ->
                document.writeTo(object : OutputStream() {
                    override fun write(value: Int) {
                        checkCancelled()
                        check(buffer.size() < MAX_OUTPUT_BYTES) { "PDF çıktısı 30 MB sınırını aşıyor." }
                        buffer.write(value)
                    }
                    override fun write(data: ByteArray, offset: Int, length: Int) {
                        checkCancelled()
                        check(buffer.size().toLong() + length <= MAX_OUTPUT_BYTES) { "PDF çıktısı 30 MB sınırını aşıyor." }
                        buffer.write(data, offset, length)
                    }
                })
                buffer.toByteArray()
            }
            return ConvertedPdf(bytes, inputs.size)
        } finally {
            try { document.close() }
            finally { decoded.forEach { it.recycle() } }
        }
    }
}
