import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ locals }) => {
  // Pass session and user data from hooks to all routes
  return {
    session: locals.session,
    user: locals.user,
  };
};
