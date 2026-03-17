const noop = (): void => {}

const log = {
  info: noop,
  warn: noop,
  error: noop,
  debug: noop,
  verbose: noop,
  transports: {
    file: { resolvePathFn: null as null | (() => string), maxSize: 0, format: '' },
    console: { format: '' },
  },
}

export default log
