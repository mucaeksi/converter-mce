package com.mucaeksi.convertermce

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.ByteArrayOutputStream
import java.util.concurrent.CancellationException
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import androidx.test.ext.junit.runners.AndroidJUnit4

@RunWith(AndroidJUnit4::class)
class ImagePdfDeviceTest {
    @get:Rule val temp = TemporaryFolder()

    private fun image(width: Int, height: Int, color: Int): ByteArray {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        try {
            bitmap.eraseColor(color)
            return ByteArrayOutputStream().use { output -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, output); output.toByteArray() }
        } finally { bitmap.recycle() }
    }

    @Test fun createsOrderedReadableA4PagesWithRealColorsAndWhiteTransparency() {
        val result = ImagePdfConverter.convert(listOf(image(80, 160, Color.RED), image(160, 80, Color.BLUE), image(80, 40, Color.TRANSPARENT)), null)
        assertEquals(3, result.pages)
        assertTrue(String(result.bytes, 0, 5, Charsets.US_ASCII) == "%PDF-")
        val file = temp.newFile("images.pdf").apply { writeBytes(result.bytes) }
        PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use { renderer ->
            assertEquals(3, renderer.pageCount)
            for (index in 0..2) renderer.openPage(index).use { page ->
                assertEquals(if (index == 0) 595 else 842, page.width)
                assertEquals(if (index == 0) 842 else 595, page.height)
                val pixels = Bitmap.createBitmap(page.width, page.height, Bitmap.Config.ARGB_8888)
                try {
                    page.render(pixels, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    val center = pixels.getPixel(page.width / 2, page.height / 2)
                    if (index == 0) { assertTrue(Color.red(center) >= 250); assertTrue(Color.blue(center) <= 5) }
                    if (index == 1) { assertTrue(Color.blue(center) >= 250); assertTrue(Color.red(center) <= 5) }
                    if (index == 2) { assertTrue(Color.red(center) >= 250); assertTrue(Color.blue(center) >= 250) }
                    assertEquals(Color.WHITE, pixels.getPixel(1, 1))
                } finally { pixels.recycle() }
            }
        }
    }

    @Test fun rejectsInvalidImagesCountsSizesAndOptions() {
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(emptyList()) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(List(9) { byteArrayOf(1) }) }
        val tooLarge = List(3) { ByteArray(7 * 1024 * 1024) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(tooLarge) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(listOf(byteArrayOf(1, 2, 3))) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(listOf(image(80, 40, Color.RED)), 0) }
    }

    @Test fun cancellationReleasesTheDocumentAndAllowsAnotherConversion() {
        val input = image(80, 40, Color.BLUE)
        var checks = 0
        assertThrows(CancellationException::class.java) {
            ImagePdfConverter.convert(listOf(input, input)) { if (++checks == 2) throw CancellationException("Canceled") }
        }
        assertEquals(1, ImagePdfConverter.convert(listOf(input)).pages)
    }
}
