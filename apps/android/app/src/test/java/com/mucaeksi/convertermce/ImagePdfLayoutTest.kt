package com.mucaeksi.convertermce

import java.util.concurrent.CancellationException
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ImagePdfLayoutTest {
    @Test fun fitsPortraitAndLandscapeWithoutCroppingOrStretching() {
        for ((width, height) in listOf(80 to 160, 160 to 80, 4000 to 100, 100 to 4000)) {
            val p = ImagePdfConverter.placement(width, height)
            assertEquals(if (width > height) 842 else 595, p.pageWidth)
            assertEquals(if (width > height) 595 else 842, p.pageHeight)
            assertTrue(p.left >= 23.999f && p.top >= 23.999f)
            assertTrue(p.right <= p.pageWidth - 23.999f && p.bottom <= p.pageHeight - 23.999f)
            assertEquals(width.toDouble() / height, (p.right - p.left).toDouble() / (p.bottom - p.top), 0.0001)
        }
    }

    @Test fun rejectsInvalidInputBeforeCreatingPages() {
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(emptyList()) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(List(9) { byteArrayOf(1) }) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(List(3) { ByteArray(7 * 1024 * 1024) }) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.convert(listOf(byteArrayOf(1)), 0) }
        assertThrows(IllegalArgumentException::class.java) { ImagePdfConverter.placement(50_000, 50_000) }
    }

    @Test fun cancellationPreventsPageCreation() {
        assertThrows(CancellationException::class.java) {
            ImagePdfConverter.convert(listOf(byteArrayOf(1))) { throw CancellationException("Canceled") }
        }
    }
}
