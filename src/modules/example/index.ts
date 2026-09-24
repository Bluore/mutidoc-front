/**
 * 模块对外出口（Public API）。
 * 其它模块若需要引用本模块，只能从这里导入；不要深入引用内部文件。
 */
export { default as exampleRoutes } from './routes'
export { useExampleStore } from './stores/example'
export * from './types'
export * from './constants'
