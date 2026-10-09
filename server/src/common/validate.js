/**
 * validate({ params, query, body }) - parses each part with its zod schema and
 * replaces it with the parsed (coerced, trimmed, defaulted) value.
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) req[key] = schemas[key].parse(req[key]);
    }
    next();
  } catch (err) {
    next(err);
  }
};
