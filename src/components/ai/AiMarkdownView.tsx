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
  TextStyle,
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
 * Markdown Table Renderer with Horizontal Scrolling
 */
function MarkdownTable({ token, isUser, accentColor, currencyRegex }: {
  token: Tokens.Table;
  isUser?: boolean;
  accentColor: string;
  currencyRegex: RegExp;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
      <View style={styles.tableContainer}>
        {/* Header Row */}
        <View style={styles.tableHeaderRow}>
          {token.header.map((cell, colIdx) => (
            <View key={colIdx} style={[styles.tableCell, styles.tableHeaderCell]}>
              <Text style={styles.tableHeaderText}>
                {renderInlineTokens(cell.tokens, isUser, accentColor, currencyRegex)}
              </Text>
            </View>
          ))}
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
            {row.map((cell, colIdx) => (
              <View key={colIdx} style={styles.tableCell}>
                <Text style={styles.tableCellText}>
                  {renderInlineTokens(cell.tokens, isUser, accentColor, currencyRegex)}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
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
            {renderInlineTokens(token.tokens, isUser, accentColor, currencyRegex)}
          </Text>
        );

      case 'em':
        return (
          <Text key={i} style={[styles.em, isUser && styles.userEm]}>
            {renderInlineTokens(token.tokens, isUser, accentColor, currencyRegex)}
          </Text>
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

      case 'text':
      default: {
        const rawText = ('text' in token && typeof (token as any).text === 'string' ? (token as any).text : token.raw) || '';
        // High-precision financial entity matcher: highlight amounts with accent color
        const parts: Array<{ type: 'currency' | 'text'; content: string }> = [];
        let lastIdx = 0;
        let match: RegExpExecArray | null;

        // Reset regex state
        currencyRegex.lastIndex = 0;
        while ((match = currencyRegex.exec(rawText)) !== null) {
          if (match.index > lastIdx) {
            parts.push({ type: 'text', content: rawText.substring(lastIdx, match.index) });
          }
          parts.push({ type: 'currency', content: match[0] });
          lastIdx = currencyRegex.lastIndex;
        }
        if (lastIdx < rawText.length) {
          parts.push({ type: 'text', content: rawText.substring(lastIdx) });
        }

        if (parts.length <= 1 && parts[0]?.type === 'text') {
          return <Text key={i}>{rawText}</Text>;
        }

        return (
          <Text key={i}>
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
    }
  });
}

/**
 * Flagship AST Markdown View for Mobile AI Chat
 * Renders complete GitHub Flavored Markdown (bold, italic, code blocks, lists,
 * tables, blockquotes, headings, currency highlights, and streaming caret).
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

  // Parse markdown AST with marked.lexer
  const tokens = useMemo(() => {
    if (!content) return [];
    // Defensively normalize literal \r\n and \n sequences
    const normalized = content.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
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
              <View key={idx} style={styles.listContainer}>
                {listToken.items.map((item, itemIdx) => {
                  const numberLabel = listToken.ordered
                    ? `${(typeof listToken.start === 'number' ? listToken.start : 1) + itemIdx}.`
                    : null;

                  return (
                    <View key={itemIdx} style={styles.listItemRow}>
                      {numberLabel ? (
                        <Text style={[styles.listNumber, { color: currentAccent.primary }]}>
                          {numberLabel}
                        </Text>
                      ) : (
                        <View style={styles.bulletDotSlot}>
                          <View
                            style={[
                              styles.bulletDot,
                              { backgroundColor: currentAccent.primary },
                            ]}
                          />
                        </View>
                      )}

                      <View style={styles.listContentSlot}>
                        <Text style={[styles.baseText, isUser && styles.userText]}>
                          {renderInlineTokens(item.tokens, isUser, currentAccent.primary, currencyRegex)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
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
    gap: 4,
    maxWidth: '100%',
  },
  paragraphWrap: {
    marginVertical: 1,
  },
  baseText: {
    fontSize: 13.5,
    lineHeight: 20.5,
    color: THEME.colors.text,
    letterSpacing: 0.1,
  },
  userText: {
    color: '#FFFFFF',
  },
  spacer: {
    height: 4,
  },

  /* Typography Hierarchies */
  h1: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.text,
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  h2: {
    fontSize: 15.5,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 6,
    marginBottom: 3,
    letterSpacing: -0.15,
  },
  h3: {
    fontSize: 14.5,
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 5,
    marginBottom: 2,
    letterSpacing: -0.1,
  },

  /* Inline Styling */
  strong: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userStrong: {
    fontWeight: '800',
    color: '#FFFFFF',
  },
  em: {
    fontStyle: 'italic',
    color: THEME.colors.textSecondary,
  },
  userEm: {
    fontStyle: 'italic',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  del: {
    textDecorationLine: 'line-through',
    color: THEME.colors.textMuted,
  },
  inlineCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: THEME.colors.aiLight,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  currencyHighlight: {
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  /* Lists */
  listContainer: {
    gap: 4,
    marginVertical: 2,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletDotSlot: {
    width: 14,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  listNumber: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 16,
    lineHeight: 20,
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
    marginVertical: 6,
  },
  tableContainer: {
    borderRadius: 10,
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
    paddingVertical: 8,
    minWidth: 80,
    justifyContent: 'center',
  },
  tableHeaderCell: {
    paddingVertical: 9,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  tableCellText: {
    fontSize: 12.5,
    color: THEME.colors.textSecondary,
  },

  /* Separator & Caret */
  horizontalRule: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  typewriterCursor: {
    fontSize: 13.5,
    fontWeight: '900',
    marginTop: 2,
    marginLeft: 1,
  },
});
