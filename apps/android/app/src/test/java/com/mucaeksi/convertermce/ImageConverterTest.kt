package com.mucaeksi.convertermce

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import java.io.ByteArrayOutputStream
import java.io.ByteArrayInputStream
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ImageConverterTest {
    @Test fun preservesAspectRatioAndDoesNotUpscale() {
        assertEquals(400 to 200, ImageConverter.dimensions(800, 400, 400))
        assertEquals(800 to 400, ImageConverter.dimensions(800, 400, 1200))
    }

    @Test fun convertsTransparentPngToReadableWhiteJpeg() {
        val source = Bitmap.createBitmap(80, 40, Bitmap.Config.ARGB_8888)
        source.eraseColor(Color.TRANSPARENT)
        val input = ByteArrayOutputStream().use { stream -> source.compress(Bitmap.CompressFormat.PNG, 100, stream); stream.toByteArray() }
        source.recycle()
        val result = ImageConverter.convertToJpeg(input, 85, 40)
        assertEquals(40, result.width)
        assertEquals(20, result.height)
        assertEquals(0xff, result.bytes[0].toInt() and 0xff)
        assertEquals(0xd8, result.bytes[1].toInt() and 0xff)
        val decoded = BitmapFactory.decodeByteArray(result.bytes, 0, result.bytes.size)
        assertNotNull(decoded)
        assertTrue(Color.red(decoded.getPixel(10, 10)) >= 250)
        assertTrue(Color.green(decoded.getPixel(10, 10)) >= 250)
        decoded.recycle()
    }

    @Test fun rejectsInvalidInputAndMemoryBombs() {
        assertThrows(IllegalArgumentException::class.java) { ImageConverter.convertToJpeg(byteArrayOf(1, 2, 3)) }
        assertThrows(IllegalArgumentException::class.java) { ImageConverter.dimensions(50_000, 50_000, null) }
        assertThrows(IllegalArgumentException::class.java) { ImageConverter.dimensions(80, 40, 0) }
        assertThrows(IllegalArgumentException::class.java) { ImageConverter.readInput(ByteArrayInputStream(ByteArray(ImageConverter.MAX_INPUT_BYTES + 1))) }
    }
}
