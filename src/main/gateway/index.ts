/**
 * Gateway 管理模块统一导出
 */

export { GatewayProcess, getGatewayProcess, createGatewayProcess } from './process'

export type {
  GatewayState,
  GatewayStateChange,
  GatewayStartResult,
  StateChangeCallback,
  LogCallback,
} from './process'

export {
  resolveGatewayToken,
  generateToken,
  maskToken,
  buildTokenInjectionScript,
  buildConnectFrame,
} from './auth'

export { loadOrCreateDeviceIdentity, signDevicePayload } from './device-identity'

export type { DeviceIdentity } from './device-identity'

export { loadDeviceToken, storeDeviceToken, clearDeviceToken } from './device-auth-store'
