/**
 * When true, serializes the non-wire op for size comparison (extra CPU on send).
 * Keep false in normal use; enable only when benchmarking wire vs JSON payload size.
 */
export const WS_LOG_WIRE_VS_NORMAL_PAYLOAD = false;
