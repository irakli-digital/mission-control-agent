export function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    console.log(`[mc-api] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    originalEnd.apply(res, args);
  };

  next();
}
