/**
 * validate({ params, query, body }) - parses each part with its zod schema and
 * replaces it with the parsed (coerced, trimmed, defaulted) value.
 * Express 5 exposes req.query as a getter, so we redefine it instead of assigning.
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    for (const key of ['params', 'query', 'body']) {
      if (!schemas[key]) continue;
      const parsed = schemas[key].parse(req[key] ?? {});
      Object.defineProperty(req, key, { value: parsed, writable: true, configurable: true, enumerable: true });
    }
    next();
  } catch (err) {
    next(err);
  }
};
