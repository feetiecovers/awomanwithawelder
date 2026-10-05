export type ParametricValidationMessage = { ruleId: string; severity: "blocker" | "warning" | "info"; message: string; left: string; right: string | number };
export type ParametricValidationRule = { id: string; left: string; operator: "<" | "<=" | ">" | ">=" | "=" | "!="; right: string | number; severity: "blocker" | "warning" | "info"; message: string };

export function evaluateParametricValidation(rules: ParametricValidationRule[] | undefined, values: Record<string, unknown>) {
  const result = { blockers: [] as ParametricValidationMessage[], warnings: [] as ParametricValidationMessage[], info: [] as ParametricValidationMessage[] };
  for (const rule of rules ?? []) {
    const left = Number(values[rule.left]);
    const right = typeof rule.right === 'number' ? rule.right : Number(values[rule.right]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    const valid = rule.operator === '<' ? left < right : rule.operator === '<=' ? left <= right : rule.operator === '>' ? left > right : rule.operator === '>=' ? left >= right : rule.operator === '=' ? left === right : left !== right;
    if (valid) continue;
    result[rule.severity === 'blocker' ? 'blockers' : rule.severity === 'warning' ? 'warnings' : 'info'].push({ ruleId: rule.id, severity: rule.severity, message: rule.message, left: rule.left, right: rule.right });
  }
  return result;
}
