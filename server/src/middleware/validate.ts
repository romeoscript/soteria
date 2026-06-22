import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

// Validates and narrows request parts; throws ZodError (handled centrally).
export const validate =
  (schemas: Schemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  };
