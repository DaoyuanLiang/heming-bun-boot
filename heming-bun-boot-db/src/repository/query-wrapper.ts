interface Condition {
  type: "and" | "or";
  sql: string;
  params: any[];
  children?: ConditionGroup;
}

interface ConditionGroup {
  conditions: Condition[];
  nextOr: boolean;
}

export class QueryWrapper<T = any> {
  private escapeFn: (name: string) => string;

  constructor(escapeIdentifier?: (name: string) => string) {
    this.escapeFn = escapeIdentifier ?? ((name: string) => `\`${name}\``);
  }

  private group: ConditionGroup = { conditions: [], nextOr: false };
  private orderByFields: string[] = [];
  private groupByFields: string[] = [];
  private havingClause = "";
  private havingParams: any[] = [];
  private selectFields: string[] = [];
  private limitValue = 0;
  private offsetValue = 0;
  private lastSql = "";

  // ========== Comparison ==========

  eq(field: keyof T & string, value: any): this {
    this.addCondition(`${this.col(field)} = ?`, [value]);
    return this;
  }

  ne(field: keyof T & string, value: any): this {
    this.addCondition(`${this.col(field)} != ?`, [value]);
    return this;
  }

  gt(field: keyof T & string, value: any): this {
    this.addCondition(`${this.col(field)} > ?`, [value]);
    return this;
  }

  ge(field: keyof T & string, value: any): this {
    this.addCondition(`${this.col(field)} >= ?`, [value]);
    return this;
  }

  lt(field: keyof T & string, value: any): this {
    this.addCondition(`${this.col(field)} < ?`, [value]);
    return this;
  }

  le(field: keyof T & string, value: any): this {
    this.addCondition(`${this.col(field)} <= ?`, [value]);
    return this;
  }

  between(field: keyof T & string, start: any, end: any): this {
    this.addCondition(`${this.col(field)} BETWEEN ? AND ?`, [start, end]);
    return this;
  }

  notBetween(field: keyof T & string, start: any, end: any): this {
    this.addCondition(`${this.col(field)} NOT BETWEEN ? AND ?`, [start, end]);
    return this;
  }

  // ========== LIKE ==========

  like(field: keyof T & string, value: string): this {
    this.addCondition(`${this.col(field)} LIKE ?`, [`%${value}%`]);
    return this;
  }

  likeLeft(field: keyof T & string, value: string): this {
    this.addCondition(`${this.col(field)} LIKE ?`, [`%${value}`]);
    return this;
  }

  likeRight(field: keyof T & string, value: string): this {
    this.addCondition(`${this.col(field)} LIKE ?`, [`${value}%`]);
    return this;
  }

  notLike(field: keyof T & string, value: string): this {
    this.addCondition(`${this.col(field)} NOT LIKE ?`, [`%${value}%`]);
    return this;
  }

  // ========== IN / NULL ==========

  in(field: keyof T & string, values: any[]): this {
    const placeholders = values.map(() => "?").join(", ");
    this.addCondition(`${this.col(field)} IN (${placeholders})`, values);
    return this;
  }

  notIn(field: keyof T & string, values: any[]): this {
    const placeholders = values.map(() => "?").join(", ");
    this.addCondition(`${this.col(field)} NOT IN (${placeholders})`, values);
    return this;
  }

  isNull(field: keyof T & string): this {
    this.addCondition(`${this.col(field)} IS NULL`, []);
    return this;
  }

  isNotNull(field: keyof T & string): this {
    this.addCondition(`${this.col(field)} IS NOT NULL`, []);
    return this;
  }

  // ========== Logic ==========

  and(fn: (w: QueryWrapper<T>) => void): this {
    const wrapper = new QueryWrapper<T>(this.escapeFn);
    fn(wrapper);
    this.addNested("and", wrapper.group);
    return this;
  }

  or(fn?: (w: QueryWrapper<T>) => void): this {
    if (fn) {
      const wrapper = new QueryWrapper<T>(this.escapeFn);
      fn(wrapper);
      this.addNested("or", wrapper.group);
    } else {
      this.group.nextOr = true;
    }
    return this;
  }

  // ========== Order / Group ==========

  orderBy(field: keyof T & string, asc = true): this {
    this.orderByFields.push(`${this.col(field)} ${asc ? "ASC" : "DESC"}`);
    return this;
  }

  orderByAsc(field: keyof T & string): this {
    return this.orderBy(field, true);
  }

  orderByDesc(field: keyof T & string): this {
    return this.orderBy(field, false);
  }

  groupBy(...fields: (keyof T & string)[]): this {
    this.groupByFields = fields.map(f => this.col(f));
    return this;
  }

  having(condition: string, ...params: any[]): this {
    this.havingClause = condition;
    this.havingParams = params;
    return this;
  }

  // ========== Select / Page ==========

  select(...fields: (keyof T & string)[]): this {
    this.selectFields = fields.map(f => this.col(f));
    return this;
  }

  limit(n: number): this {
    this.limitValue = n;
    return this;
  }

  offset(n: number): this {
    this.offsetValue = n;
    return this;
  }

  last(sql: string): this {
    this.lastSql = sql;
    return this;
  }

  // ========== Builders (internal) ==========

  buildWhere(): { sql: string; params: any[] } {
    return this.buildGroup(this.group);
  }

  buildOrderBy(): string {
    return this.orderByFields.join(", ");
  }

  buildSelectColumns(defaultColumns: string): string {
    return this.selectFields.length > 0 ? this.selectFields.join(", ") : defaultColumns;
  }

  getLimit(): number {
    return this.limitValue;
  }

  getOffset(): number {
    return this.offsetValue;
  }

  getGroupBy(): string {
    return this.groupByFields.join(", ");
  }

  getHaving(): { sql: string; params: any[] } {
    return { sql: this.havingClause, params: this.havingParams };
  }

  getLast(): string {
    return this.lastSql;
  }

  // ========== Internal ==========

  private col(field: string): string {
    // If already quoted (backtick or double-quote) or contains a dot (table.col), leave as-is
    if (field.includes("`") || field.includes("\"") || field.includes(".")) return field;
    return this.escapeFn(field);
  }

  private addCondition(sql: string, params: any[]): void {
    this.group.conditions.push({
      type: this.group.nextOr ? "or" : "and",
      sql,
      params,
    });
    this.group.nextOr = false;
  }

  private addNested(logic: "and" | "or", nested: ConditionGroup): void {
    this.group.conditions.push({
      type: logic,
      sql: "",
      params: [],
      children: nested,
    });
  }

  private buildGroup(group: ConditionGroup): { sql: string; params: any[] } {
    if (group.conditions.length === 0) return { sql: "", params: [] };

    const parts: string[] = [];
    const allParams: any[] = [];

    for (let i = 0; i < group.conditions.length; i++) {
      const cond = group.conditions[i];
      const prefix = i === 0 ? "" : ` ${cond.type.toUpperCase()} `;

      if (cond.children) {
        const child = this.buildGroup(cond.children);
        if (child.sql) {
          parts.push(`${prefix}(${child.sql})`);
          allParams.push(...child.params);
        }
      } else {
        parts.push(`${prefix}${cond.sql}`);
        allParams.push(...cond.params);
      }
    }

    return { sql: parts.join(""), params: allParams };
  }
}
