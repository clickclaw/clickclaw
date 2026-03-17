/**
 * 开机自启管理
 * 封装 Electron app.setLoginItemSettings / app.getLoginItemSettings
 *
 * 行为说明：
 * - macOS：通过 Launch Services 写入 Login Items（仅 packaged app 有效，开发模式下调用不报错但不生效）
 * - Windows：写入 HKCU\Software\Microsoft\Windows\CurrentVersion\Run 注册表
 * - Linux：不支持（Electron API 无效果），返回 false
 */

import { app } from 'electron'
import { createLogger } from '../logger'

const log = createLogger('launch-at-login')

/** 获取当前是否已设置开机自启 */
export function getLaunchAtLoginEnabled(): boolean {
  try {
    const settings = app.getLoginItemSettings()
    return settings.openAtLogin
  } catch (err) {
    log.warn('getLoginItemSettings failed:', err)
    return false
  }
}

/** 设置开机自启（true = 启用，false = 禁用） */
export function setLaunchAtLoginEnabled(enabled: boolean): void {
  try {
    app.setLoginItemSettings({ openAtLogin: enabled })
    log.info(`launch at login: ${enabled ? 'enabled' : 'disabled'}`)
  } catch (err) {
    log.warn('setLoginItemSettings failed:', err)
    throw err
  }
}
