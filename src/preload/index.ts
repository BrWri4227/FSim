import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('fsim', {
  version: '0.1.0'
})
