/**
 * Shared {{variable}} interpolation for outbound email templates.
 * Never silently drop a required value — partners must not receive sentences with holes.
 */

export class UnresolvedEmailTemplateError extends Error {
  readonly variable: string;
  readonly kind: "missing" | "empty";

  constructor(kind: "missing" | "empty", variable: string) {
    super(
      kind === "missing"
        ? `Missing email template variable: ${variable}`
        : `Empty email template variable: ${variable}`
    );
    this.name = "UnresolvedEmailTemplateError";
    this.kind = kind;
    this.variable = variable;
  }
}

/**
 * Replace `{{name}}` placeholders. Every referenced variable must be present and
 * non-empty (after trim), unless listed in `allowEmpty`.
 * Does not collapse newlines (previous lifecycle helper did — that hid empty vars).
 */
export function renderEmailTemplate(
  template: string,
  variables: Record<string, string>,
  options?: { allowEmpty?: readonly string[] }
): string {
  const allowEmpty = new Set(options?.allowEmpty ?? []);
  return template
    .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      if (!Object.prototype.hasOwnProperty.call(variables, key)) {
        throw new UnresolvedEmailTemplateError("missing", key);
      }
      const value = String(variables[key] ?? "").trim();
      if (!value && !allowEmpty.has(key)) {
        throw new UnresolvedEmailTemplateError("empty", key);
      }
      return value;
    })
    .trim();
}

/**
 * Render subject + body. On unresolved variables: throw in development;
 * in production return ok:false so callers skip send instead of mailing garbage.
 */
export function renderEmailTemplatePair(
  subjectTemplate: string,
  bodyTemplate: string,
  variables: Record<string, string>,
  options?: { allowEmpty?: readonly string[]; context?: string }
):
  | { ok: true; subject: string; body: string }
  | { ok: false; error: string } {
  try {
    const subject = renderEmailTemplate(subjectTemplate, variables, options);
    const body = renderEmailTemplate(bodyTemplate, variables, options);
    if (!subject || !body) {
      throw new UnresolvedEmailTemplateError("empty", !subject ? "subject" : "body");
    }
    return { ok: true, subject, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const ctx = options?.context ? ` [${options.context}]` : "";
    console.error(`[email-template] unresolved variable${ctx}:`, message, { variables });
    if (process.env.NODE_ENV !== "production") {
      throw err instanceof Error ? err : new Error(message);
    }
    return { ok: false, error: message };
  }
}
