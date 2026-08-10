import { FieldErrors } from "react-hook-form";
import * as z from "zod";

export function zodResolver<T extends z.ZodTypeAny>(schema: T) {
  return async (values: any) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) {
      return { values: result.data, errors: {} };
    }

    const errors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (!errors[path]) {
        errors[path] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }

    return { values: {}, errors };
  };
}
