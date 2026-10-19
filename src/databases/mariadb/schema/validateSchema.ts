import { ParserRuleContext } from 'antlr4ng'
import type { ParseTree, Token } from 'antlr4ng'
import * as P from 'dt-sql-parser/dist/lib/mysql/MySqlParser'
import { MySqlLexer } from 'dt-sql-parser/dist/lib/mysql/MySqlLexer'
import { decodeSqlString } from '../../shared/mysqlMariaDb/parsing/importCondition'
import { mariadbSchemaExpressionError } from '../parsing/validateSubset'

const columnTypes = new Set([
  'TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'INTEGER', 'BIGINT', 'BIT',
  'DECIMAL', 'DEC', 'NUMERIC', 'FIXED', 'FLOAT', 'DOUBLE', 'REAL', 'BOOL', 'BOOLEAN', 'SERIAL',
  'CHAR', 'VARCHAR', 'BINARY', 'VARBINARY', 'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'TINYBLOB', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB', 'ENUM', 'SET', 'DATE', 'TIME',
  'DATETIME', 'TIMESTAMP', 'YEAR', 'JSON', 'GEOMETRY', 'POINT', 'LINESTRING', 'POLYGON',
  'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION',
])
const columnConstraints = [
  P.NullColumnConstraintContext, P.DefaultColumnConstraintContext, P.AutoIncrementColumnConstraintContext,
  P.PrimaryKeyColumnConstraintContext, P.UniqueKeyColumnConstraintContext, P.CommentColumnConstraintContext,
  P.CollateColumnConstraintContext, P.GeneratedColumnConstraintContext, P.CheckExprContext,
  P.ReferenceColumnConstraintContext, P.SerialDefaultColumnConstraintContext,
]
const tableOptions = [
  P.TableOptionEngineContext, P.TableOptionCharsetContext, P.TableOptionCollateContext,
  P.TableOptionCommentContext, P.TableOptionAutoIncrementContext, P.TableOptionRowFormatContext,
  P.TableOptionAverageContext, P.TableOptionMinRowsContext, P.TableOptionMaxRowsContext,
  P.TableOptionKeyBlockSizeContext,
]
const charsets = new Set(['utf8mb4', 'utf8mb3', 'latin1', 'ascii', 'binary'])
const collations = new Set([
  'utf8mb4_bin', 'utf8mb4_general_ci', 'utf8mb3_bin', 'utf8mb3_general_ci',
  'latin1_bin', 'latin1_swedish_ci', 'ascii_bin', 'ascii_general_ci', 'binary',
  'utf8mb4_unicode_ci', 'utf8mb4_unicode_520_ci', 'utf8mb3_unicode_ci', 'utf8mb3_unicode_520_ci',
])

// Decode grammar-provided option names without translating SQL or deriving column suggestions.
function optionName(node: ParseTree): string {
  const spelling = node.getText()
  if (/^["']/.test(spelling)) return decodeSqlString(spelling, 'MariaDB').toLowerCase()
  return (spelling.startsWith('`') ? spelling.slice(1, -1).replaceAll('``', '`') : spelling).toLowerCase()
}

// Fail closed for MySQL grammar extensions outside the documented MariaDB schema subset.
function unsupported(node: ParseTree): never {
  throw new Error(`Unsupported MariaDB 11.4 schema syntax: ${node.getText().slice(0, 100)}. Use the supported explicit CREATE TABLE subset.`)
}

// Validate original expression tokens with schema collations, outside the shared field model.
function validateExpression(node: ParserRuleContext, tokens: Token[], predicate: boolean): void {
  const start = node.start?.start ?? -1
  const stop = node.stop?.stop ?? -1
  const expressionTokens = tokens
    .filter((token) => token.start >= start && token.stop <= stop && token.type !== -1 &&
      (token.channel === 0 || token.type === MySqlLexer.STRING_CHARSET_NAME))
    .map((token) => ({ text: token.text ?? '', type: token.type, start: token.start, stop: token.stop }))
  const error = mariadbSchemaExpressionError(expressionTokens, predicate, collations)
  if (error) throw new Error(`Unsupported MariaDB schema expression: ${error}`)
}

// Inspect AST clauses independently of MySQL grammar acceptance before extracting any columns.
function validateNode(node: ParseTree, tokens: Token[]): void {
  if (node instanceof P.DataTypeContext && !columnTypes.has(node.start?.text?.toUpperCase() ?? '')) unsupported(node)
  if (node instanceof P.SpatialDataTypeContext && node.KW_SRID()) unsupported(node)
  if (node instanceof P.ColumnConstraintContext && !columnConstraints.some((kind) => node instanceof kind)) unsupported(node)
  if (node instanceof P.TableOptionContext && !tableOptions.some((kind) => node instanceof kind)) unsupported(node)
  if (node instanceof P.CharsetNameContext && !charsets.has(optionName(node))) unsupported(node)
  if (node instanceof P.CollationNameContext && !collations.has(optionName(node))) unsupported(node)
  if (node instanceof P.EngineNameContext && !['innodb', 'myisam', 'memory'].includes(optionName(node))) unsupported(node)
  if (node instanceof P.TableOptionEngineContext && !node.engineName()) unsupported(node)
  if (node instanceof P.TableOptionCharsetContext && !node.charsetName()) unsupported(node)
  if (node instanceof P.TableOptionRowFormatContext && node.ID()) unsupported(node)
  if (node instanceof P.IndexOptionContext && (node.KW_ENGINE_ATTRIBUTE() || node.KW_SECONDARY_ENGINE_ATTRIBUTE() ||
    node.KW_VISIBLE() || node.KW_INVISIBLE() || node.KW_WITH())) unsupported(node)
  if (node instanceof P.GeneratedColumnConstraintContext) {
    validateExpression(node.expression(), tokens, false)
    return
  }
  if (node instanceof P.CheckConstraintDefinitionContext) {
    if (node.KW_ENFORCED() || node.KW_NOT()) unsupported(node)
    validateExpression(node.expression(), tokens, true)
    return
  }
  if (node instanceof P.CreateDefinitionContext && node.expression()) {
    validateExpression(node.expression()!, tokens, true)
    return
  }
  if (node instanceof P.DefaultValueContext) {
    if (node.currentTimestamp().length) {
      for (const timestamp of node.currentTimestamp()) {
        const precision = timestamp.decimalLiteral()?.getText()
        if (precision !== undefined && !/^[0-6]$/.test(precision)) unsupported(timestamp)
        if (timestamp.KW_NOW() && !timestamp.LR_BRACKET()) unsupported(timestamp)
      }
    } else {
      if (node.fullId()) unsupported(node)
      validateExpression(node, tokens, false)
    }
    return
  }
  // Expressions in other contexts (including functional indexes) have no established compatibility path.
  if (node instanceof P.ExpressionContext) unsupported(node)
  for (let index = 0; index < node.getChildCount(); index += 1) {
    const child = node.getChild(index)
    if (child) validateNode(child, tokens)
  }
}

// Apply the MariaDB 11.4 schema policy without changing the existing MySQL importer policy.
export function validateMariadbSchemaTable(table: P.ColumnCreateTableContext, tokens: Token[]): void {
  if (table.partitionDefinitions()) unsupported(table.partitionDefinitions()!)
  validateNode(table, tokens)
}
