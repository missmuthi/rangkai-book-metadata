import type { Actions } from "@sveltejs/kit";
import { fail } from "@sveltejs/kit";
import { manualScanSchema } from "$lib/schemas";
import { getRawDb, createScan, requireUser } from "$lib/server";

export const load = async (event: any) => {
  // Provide an initial minimal form payload for the client
  return {
    form: { data: { isbn: "", title: "" }, errors: {}, message: undefined },
  };
};

export const actions: Actions = {
  default: async (event) => {
    // Require an authenticated user
    const user = await requireUser(event);
    const formData = await event.request.formData();
    const payload = Object.fromEntries(formData.entries()) as Record<
      string,
      unknown
    >;
    const result = manualScanSchema.safeParse(payload);
    if (!result.success) {
      // Convert errors into a simple field-errors map
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path && issue.path.length > 0) {
          const key = String(issue.path[0]);
          fieldErrors[key] = issue.message;
        }
      });
      return fail(400, { form: { data: payload, errors: fieldErrors } });
    }

    // Create a new scan entry
    const db = getRawDb(event.platform);
    try {
      const scanId = await createScan(
        db,
        String(user.id),
        String(result.data.isbn ?? ""),
        String(result.data.title ?? ""),
        JSON.stringify(result.data.json_data ?? {}),
        (result.data as any).status ?? "draft",
      );

      return { form: { data: result.data, errors: {} }, success: true, scanId };
    } catch (err) {
      console.error("createScan failed:", err);
      return fail(500, {
        form: { data: payload, errors: {} },
        error: "Failed to create scan",
      });
    }
  },
};

export const csr = true;
