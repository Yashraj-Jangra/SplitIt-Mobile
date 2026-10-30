import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { marked, Token, Tokens } from 'marked';
import { Copy, Check, ExternalLink } from 'lucide-react-native';
import { THEME } from '../../constants/theme';
import { useAppTheme } from '../../contexts/theme.context';
import { getActiveCurrencySymbol } from '../../contexts/currency.context';
import { haptics } from '../../services/haptics.service';

export interface AiMarkdownViewProps {
  /** The markdown text to render */
  content: string;
  /** Whether the message is actively streaming tokens */
  isStreaming?: boolean;
  /** Whether the message bubble belongs to the user */
  isUser?: boolean;
  /** Optional custom container style */
  style?: StyleProp<ViewStyle>;
}

/**
 * Fenced Code Block with Syntax Backdrop & 1-Tap Copy Action
 */
function FencedCodeBlock({ text, lang }: { text: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const { currentAccent } = useAppTheme();

  const handleCopy = async () => {
    await Clipboard.setStringAsync(text);
    haptics.saveSuccess();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.codeBlockContainer}>
      <View style={styles.codeBlockHeader}>
        <Text style={styles.codeBlockLang}>
          {lang ? lang.toUpperCase() : 'CODE'}
        </Text>
        <TouchableOpacity
          onPress={handleCopy}
          style={styles.codeCopyButton}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {copied ? (
            <View style={styles.copiedRow}>
              <Check size={12} color={currentAccent.primary} />
              <Text style={[styles.codeCopyText, { color: currentAccent.primary }]}>Copied</Text>
            </View>
          ) : (
            <View style={styles.copiedRow}>
              <Copy size={12} color={THEME.colors.textMuted} />
              <Text style={styles.codeCopyText}>Copy</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeBlockScroll}>
        <Text style={styles.codeBlockText}>{text}</Text>
      </ScrollView>
    </View>
  );
}

/**
 * Markdown Table Renderer with Column Width Synchronization & Alignment
 */
function MarkdownTable({ token, isUser, accentColor, currencyRegex }: {
  token: Tokens.Table;
  isUser?: boolean;
  accentColor: string;
  currencyRegex: RegExp;
}) {
  const numCols = token.header.length;
  const colAlignments = token.align || [];

  // Calculate synchronized column widths across header and all data rows
  const colWidths = useMemo(() => {
    const widths: number[] = [];
    for (let c = 0; c < numCols; c++) {
      let maxChars = (token.header[c]?.text || '').length;
      for (const row of token.rows) {
        if (row[c]) {
          maxChars = Math.max(maxChars, (row[c]?.text || '').length);
        }
      }
      // Proportional width calculation ensuring clean vertical alignment without text clipping
      widths.push(Math.max(90, Math.min(240, Math.ceil(maxChars * 8.5) + 32)));
    }
    return widths;
  }, [token, numCols]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tableScroll}
      contentContainerStyle={styles.tableScrollContent}
    >
      <View style={styles.tableContainer}>
        {/* Header Row */}
        <View style={styles.tableHeaderRow}>
          {token.header.map((cell, colIdx) => {
            const align = colAlignments[colIdx];
            return (
              <View
                key={colIdx}
                style={[
                  styles.tableCell,
                  styles.tableHeaderCell,
                  { width: colWidths[colIdx] },
                  align === 'right' && styles.cellAlignRight,
                  align === 'center' && styles.cellAlignCenter,
                  colIdx === numCols - 1 && styles.tableCellLastCol,
                ]}
              >
                <Text
                  style={[
                    styles.tableHeaderText,
                    align === 'right' && styles.textAlignRight,
                    align === 'center' && styles.textAlignCenter,
                  ]}
                >
                  {renderInlineTokens(cell.tokens, isUser, accentColor, currencyRegex)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Data Rows */}
        {token.rows.map((row, rowIdx) => (
          <View
            key={rowIdx}
            style={[
              styles.tableRow,
              rowIdx % 2 === 1 && styles.tableRowAlt,
              rowIdx === token.rows.length - 1 && styles.tableRowLast,
            ]}
          >
            {row.map((cell, colIdx) => {
              const align = colAlignments[colIdx];
              return (
                <View
                  key={colIdx}
                  style={[
                    styles.tableCell,
                    { width: colWidths[colIdx] },
                    align === 'right' && styles.cellAlignRight,
                    align === 'center' && styles.cellAlignCenter,
                    colIdx === numCols - 1 && styles.tableCellLastCol,
                  ]}
                >
                  <Text
                    style={[
                      styles.tableCellText,
                      align === 'right' && styles.textAlignRight,
                      align === 'center' && styles.textAlignCenter,
                    ]}
                  >
                    {renderInlineTokens(cell.tokens, isUser, accentColor, currencyRegex)}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * Renders raw text with currency symbol detection & highlighting
 */
function renderTextWithCurrency(
  text: string,
  key: string,
  accentColor: string,
  currencyRegex: RegExp
): React.ReactNode {
  if (!text) return null;
  const parts: Array<{ type: 'currency' | 'text'; content: string }> = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  currencyRegex.lastIndex = 0;
  while ((match = currencyRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: text.substring(lastIdx, match.index) });
    }
    parts.push({ type: 'currency', content: match[0] });
    lastIdx = currencyRegex.lastIndex;
  }
  if (lastIdx < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIdx) });
  }

  if (parts.length <= 1 && parts[0]?.type === 'text') {
    return <Text key={key}>{text}</Text>;
  }

  return (
    <Text key={key}>
      {parts.map((p, idx) =>
        p.type === 'currency' ? (
          <Text key={idx} style={[styles.currencyHighlight, { color: accentColor }]}>
            {p.content}
          </Text>
        ) : (
          <Text key={idx}>{p.content}</Text>
        )
      )}
    </Text>
  );
}

/**
 * Secondary fallback parser: extracts **bold** and *italic* from raw un-tokenized strings
 */
function parseInlineFormattingFallback(
  rawText: string,
  keyPrefix: string,
  isUser: boolean | undefined,
  accentColor: string,
  currencyRegex: RegExp
): React.ReactNode {
  const formatRegex = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  const elements: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = formatRegex.exec(rawText)) !== null) {
    if (match.index > lastIdx) {
      elements.push(
        renderTextWithCurrency(
          rawText.substring(lastIdx, match.index),
          `${keyPrefix}_t_${lastIdx}`,
          accentColor,
          currencyRegex
        )
      );
    }
    if (match[2]) {
      // Bold
      elements.push(
        <Text key={`${keyPrefix}_b_${match.index}`} style={[styles.strong, isUser && styles.userStrong]}>
          {renderTextWithCurrency(match[2], `${keyPrefix}_bi_${match.index}`, accentColor, currencyRegex)}
        </Text>
      );
    } else if (match[3]) {
      // Italic
      elements.push(
        <Text key={`${keyPrefix}_i_${match.index}`} style={[styles.em, isUser && styles.userEm]}>
          {renderTextWithCurrency(match[3], `${keyPrefix}_ii_${match.index}`, accentColor, currencyRegex)}
        </Text>
      );
    }
    lastIdx = formatRegex.lastIndex;
  }

  if (lastIdx < rawText.length) {
    elements.push(
      renderTextWithCurrency(
        rawText.substring(lastIdx),
        `${keyPrefix}_t_${lastIdx}`,
        accentColor,
        currencyRegex
      )
    );
  }

  return elements.length > 0 ? elements : null;
}

/**
 * Recursive Inline Token Renderer
 * Maps AST inline tokens (strong, em, codespan, del, link, text) into nested React Native <Text> elements.
 */
function renderInlineTokens(
  tokens?: Token[],
  isUser?: boolean,
  accentColor: string = THEME.colors.primary,
  currencyRegex: RegExp = /(?:₹|\$|€|£|¥)[0-9,]+(?:\.[0-9]{1,2})?/g
): React.ReactNode {
  if (!tokens || tokens.length === 0) return null;

  return tokens.map((token, i) => {
    switch (token.type) {
      case 'strong':
        return (
          <Text key={i} style={[styles.strong, isUser && styles.userStrong]}>
            {token.tokens && token.tokens.length > 0
              ? renderInlineTokens(token.tokens, isUser, accentColor, currencyRegex)
              : renderTextWithCurrency(token.text, `str_${i}`, accentColor, currencyRegex)}
          </Text>
        );

      case 'em':
        return (
          <Text key={i} style={[styles.em, isUser && styles.userEm]}>
            {token.tokens && token.tokens.length > 0
              ? renderInlineTokens(token.tokens, isUser, accentColor, currencyRegex)
              : renderTextWithCurrency(token.text, `em_${i}`, accentColor, currencyRegex)}
          </Text>
        );

      case 'paragraph':
        return (
          <React.Fragment key={i}>
            {renderInlineTokens((token as Tokens.Paragraph).tokens, isUser, accentColor, currencyRegex)}
          </React.Fragment>
        );

      case 'codespan':
        return (
          <Text key={i} style={styles.inlineCode}>
            {token.text}
          </Text>
        );

      case 'del':
        return (
          <Text key={i} style={styles.del}>
            {renderInlineTokens(token.tokens, isUser, accentColor, currencyRegex)}
          </Text>
        );

      case 'link': {
        const linkToken = token as Tokens.Link;
        return (
          <Text
            key={i}
            style={[styles.link, { color: accentColor }]}
            onPress={() => {
              if (linkToken.href) {
                haptics.tap();
                Linking.openURL(linkToken.href).catch(() => {});
              }
            }}
          >
            {renderInlineTokens(linkToken.tokens, isUser, accentColor, currencyRegex) || linkToken.text}
          </Text>
        );
      }

      case 'br':
        return <Text key={i}>{'\n'}</Text>;

      case 'checkbox':
        return null;

      case 'text':
      default: {
        const textToken = token as Tokens.Text;

        // 1. Recursive evaluation if marked tokenized nested inline tokens (strong, em, etc.)
        if (textToken.tokens && textToken.tokens.length > 0) {
          return (
            <React.Fragment key={i}>
              {renderInlineTokens(textToken.tokens, isUser, accentColor, currencyRegex)}
            </React.Fragment>
          );
        }

        const rawText =
          ('text' in token && typeof (token as any).text === 'string'
            ? (token as any).text
            : token.raw) || '';

        // 2. Secondary fallback parser: if raw text still contains unparsed **bold** or *italic*
        if (rawText.includes('**') || (rawText.includes('*') && !rawText.includes(' * '))) {
          const fallbackNodes = parseInlineFormattingFallback(
            rawText,
            `fb_${i}`,
            isUser,
            accentColor,
            currencyRegex
          );
          if (fallbackNodes) {
            return <React.Fragment key={i}>{fallbackNodes}</React.Fragment>;
          }
        }

        // 3. Currency highlighting
        return renderTextWithCurrency(rawText, `txt_${i}`, accentColor, currencyRegex);
      }
    }
  });
}

/**
 * Recursive List & Nested List Renderer with Checkbox / Task Support
 */
function renderList(
  listToken: Tokens.List,
  depth: number,
  isUser: boolean,
  accentColor: string,
  currencyRegex: RegExp
): React.ReactNode {
  return (
    <View
      key={`list_${depth}_${listToken.start || 0}`}
      style={[styles.listContainer, depth > 0 && styles.nestedListContainer]}
    >
      {listToken.items.map((item, itemIdx) => {
        const isTask = Boolean(item.task);
        const numberLabel = listToken.ordered
          ? `${(typeof listToken.start === 'number' ? listToken.start : 1) + itemIdx}.`
          : null;

        // Separate inline tokens from block tokens (nested lists)
        const inlineTokens: Token[] = [];
        const nestedLists: Tokens.List[] = [];

        item.tokens.forEach((t) => {
          if (t.type === 'list') {
            nestedLists.push(t as Tokens.List);
          } else if (t.type === 'checkbox') {
            // Handled at item level by the task checkbox slot
          } else if (t.type === 'paragraph' && (t as Tokens.Paragraph).tokens) {
            (t as Tokens.Paragraph).tokens.forEach((pt) => {
              if (pt.type !== 'checkbox') inlineTokens.push(pt);
            });
          } else {
            inlineTokens.push(t);
          }
        });

        return (
          <View key={itemIdx} style={[styles.listItemRow, isTask && styles.taskItemRow]}>
            {isTask ? (
              <View style={styles.taskCheckboxSlot}>
                <View
                  style={[
                    styles.taskCheckbox,
                    item.checked && {
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                    },
                  ]}
                >
                  {item.checked && <Check size={10} color="#0D1117" strokeWidth={3} />}
                </View>
              </View>
            ) : numberLabel ? (
              <Text style={[styles.listNumber, { color: accentColor }]}>
                {numberLabel}
              </Text>
            ) : (
              <View style={styles.bulletDotSlot}>
                <View
                  style={[
                    depth === 0 ? styles.bulletDot : styles.bulletHollow,
                    {
                      backgroundColor: depth === 0 ? accentColor : 'transparent',
                      borderColor: accentColor,
                    },
                  ]}
                />
              </View>
            )}

            <View style={styles.listContentSlot}>
              {inlineTokens.length > 0 && (
                <Text style={[styles.baseText, isUser && styles.userText]}>
                  {renderInlineTokens(inlineTokens, isUser, accentColor, currencyRegex)}
                </Text>
              )}

              {/* Recursive Nested Sub-Lists */}
              {nestedLists.map((nestedList, nIdx) =>
                renderList(nestedList, depth + 1, isUser, accentColor, currencyRegex)
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Flagship AST Markdown View for Mobile AI Chat
 * Renders complete GitHub Flavored Markdown (bold, italic, code blocks, lists,
 * nested lists, checklists, tables, blockquotes, headings, currency highlights, and streaming caret).
 */
export function AiMarkdownView({
  content,
  isStreaming = false,
  isUser = false,
  style,
}: AiMarkdownViewProps) {
  const { currentAccent } = useAppTheme();

  // Currency pattern with active context symbol support
  const currencyRegex = useMemo(() => {
    const sym = getActiveCurrencySymbol();
    const escapedSym = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:${escapedSym}|[₹$€£¥])[0-9,]+(?:\\.[0-9]{1,2})?`, 'g');
  }, []);

  // Parse markdown AST with marked.lexer and bullet / task list normalization
  const tokens = useMemo(() => {
    if (!content) return [];
    const normalized = content
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/^[ \t]*•[ \t]*\[([ xX])\]/gm, '- [$1]')
      .replace(/^[ \t]*•[ \t]+/gm, '* ')
      .replace(/([^\n])\n(\|[^\n]+\|\n\|[-: |]+\|)/g, '$1\n\n$2')
      .replace(/([^\n])\n([ \t]*[-*]\s+)/g, '$1\n\n$2')
      .replace(/([^\n])\n([ \t]*[0-9]+\.\s+)/g, '$1\n\n$2');
    try {
      return marked.lexer(normalized);
    } catch {
      return [];
    }
  }, [content]);

  return (
    <View style={[styles.rootContainer, style]}>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case 'heading': {
            const hToken = token as Tokens.Heading;
            const headingStyle =
              hToken.depth === 1
                ? styles.h1
                : hToken.depth === 2
                ? styles.h2
                : styles.h3;

            return (
              <Text key={idx} style={[headingStyle, isUser && styles.userText]}>
                {renderInlineTokens(hToken.tokens, isUser, currentAccent.primary, currencyRegex)}
              </Text>
            );
          }

          case 'paragraph': {
            const pToken = token as Tokens.Paragraph;
            return (
              <View key={idx} style={styles.paragraphWrap}>
                <Text style={[styles.baseText, isUser && styles.userText]}>
                  {renderInlineTokens(pToken.tokens, isUser, currentAccent.primary, currencyRegex)}
                </Text>
              </View>
            );
          }

          case 'list': {
            const listToken = token as Tokens.List;
            return (
              <React.Fragment key={idx}>
                {renderList(listToken, 0, isUser, currentAccent.primary, currencyRegex)}
              </React.Fragment>
            );
          }

          case 'blockquote': {
            const bqToken = token as Tokens.Blockquote;
            return (
              <View
                key={idx}
                style={[
                  styles.blockquote,
                  { borderLeftColor: currentAccent.primary },
                ]}
              >
                <Text style={styles.blockquoteText}>
                  {renderInlineTokens(bqToken.tokens, isUser, currentAccent.primary, currencyRegex)}
                </Text>
              </View>
            );
          }

          case 'code': {
            const cToken = token as Tokens.Code;
            return <FencedCodeBlock key={idx} text={cToken.text} lang={cToken.lang} />;
          }

          case 'table': {
            const tToken = token as Tokens.Table;
            return (
              <MarkdownTable
                key={idx}
                token={tToken}
                isUser={isUser}
                accentColor={currentAccent.primary}
                currencyRegex={currencyRegex}
              />
            );
          }

          case 'hr':
            return <View key={idx} style={styles.horizontalRule} />;

          case 'space':
            return <View key={idx} style={styles.spacer} />;

          default:
            return null;
        }
      })}

      {/* Streaming Typewriter Cursor */}
      {isStreaming && (
        <Text style={[styles.typewriterCursor, { color: currentAccent.primary }]}>
          ▋
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    width: '100%',
  },

  /* Base Typography */
  baseText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#F1F5F9',
    letterSpacing: -0.1,
  },
  userText: {
    color: '#FFFFFF',
  },
  paragraphWrap: {
    marginVertical: 3,
  },

  /* Inline Styling */
  strong: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userStrong: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  em: {
    fontStyle: 'italic',
    color: '#CBD5E1',
  },
  userEm: {
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12.5,
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  del: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
  },
  link: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  currencyHighlight: {
    fontWeight: '800',
  },

  /* Headings */
  h1: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginTop: 10,
    marginBottom: 4,
  },
  h2: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginTop: 8,
    marginBottom: 3,
  },
  h3: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: -0.1,
    marginTop: 6,
    marginBottom: 2,
  },

  /* Lists */
  listContainer: {
    marginVertical: 4,
  },
  nestedListContainer: {
    marginTop: 4,
    marginLeft: 6,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2.5,
  },
  taskItemRow: {
    marginVertical: 3.5,
  },
  bulletDotSlot: {
    width: 16,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  bulletHollow: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  taskCheckboxSlot: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  taskCheckbox: {
    width: 15,
    height: 15,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  listNumber: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 20,
    lineHeight: 20,
    marginRight: 4,
  },
  listContentSlot: {
    flex: 1,
  },

  /* Blockquote */
  blockquote: {
    borderLeftWidth: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginVertical: 4,
  },
  blockquoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: THEME.colors.textSecondary,
    lineHeight: 19,
  },

  /* Code Block */
  codeBlockContainer: {
    backgroundColor: '#0A0F1D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 6,
    overflow: 'hidden',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  codeBlockLang: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    letterSpacing: 0.5,
  },
  codeCopyButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  copiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  codeCopyText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  codeBlockScroll: {
    padding: 12,
  },
  codeBlockText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#E2E8F0',
  },

  /* Table */
  tableScroll: {
    marginVertical: 8,
  },
  tableScrollContent: {
    paddingRight: 16,
  },
  tableContainer: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.hairline,
    overflow: 'hidden',
    backgroundColor: THEME.colors.surface,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: THEME.colors.surfaceElevated,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.hairline,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.hairline,
  },
  tableRowAlt: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: THEME.colors.hairline,
  },
  tableCellLastCol: {
    borderRightWidth: 0,
  },
  tableHeaderCell: {
    paddingVertical: 10,
    backgroundColor: THEME.colors.surfaceElevated,
  },
  cellAlignRight: {
    alignItems: 'flex-end',
  },
  cellAlignCenter: {
    alignItems: 'center',
  },
  textAlignRight: {
    textAlign: 'right',
  },
  textAlignCenter: {
    textAlign: 'center',
  },
  tableHeaderText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  tableCellText: {
    fontSize: 12.5,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },

  /* Separator & Caret */
  horizontalRule: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  spacer: {
    height: 6,
  },
  typewriterCursor: {
    fontSize: 13.5,
    fontWeight: '900',
    marginTop: 2,
    marginLeft: 1,
  },
});
