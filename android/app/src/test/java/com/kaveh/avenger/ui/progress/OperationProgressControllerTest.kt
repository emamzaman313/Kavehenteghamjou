package com.kaveh.avenger.ui.progress

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OperationProgressControllerTest {
    @Test
    fun progressDoesNotMoveBackwardsAndCompletesOnlyAfterActionReturns() {
        runBlocking {
            val result = OperationProgressController.run("test operation") { progress ->
                progress.advance(64, "server accepted step one")
                assertEquals(64, OperationProgressController.state.value?.percent)
                progress.advance(24, "late callback must not regress progress")
                assertEquals(64, OperationProgressController.state.value?.percent)
                "saved"
            }

            assertEquals("saved", result)
            assertEquals(100, OperationProgressController.state.value?.percent)
            assertEquals(OperationStatus.SUCCESS, OperationProgressController.state.value?.status)
            OperationProgressController.state.value?.id?.let(OperationProgressController::dismiss)
        }
    }

    @Test
    fun failedActionDoesNotReportSuccess() {
        runBlocking {
            try {
                OperationProgressController.run<Unit>("failing operation") { progress ->
                    progress.advance(58, "waiting for server")
                    throw IllegalStateException("network failure")
                }
                throw AssertionError("Expected operation to fail")
            } catch (expected: IllegalStateException) {
                assertEquals("network failure", expected.message)
            }

            val state = OperationProgressController.state.value
            assertTrue(state != null)
            assertEquals(OperationStatus.FAILURE, state?.status)
            assertEquals(58, state?.percent)
            state?.id?.let(OperationProgressController::dismiss)
        }
    }
}
