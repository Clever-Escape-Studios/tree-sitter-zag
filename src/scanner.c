#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"
#include <wctype.h>

enum TokenType {
    AUTOMATIC_SEMICOLON,
    TEMPLATE_CHARS,
    TERNARY_QMARK,
};

void *tree_sitter_zag_external_scanner_create() {
    return NULL;
}

void tree_sitter_zag_external_scanner_destroy(void *payload) {
}

unsigned tree_sitter_zag_external_scanner_serialize(void *payload, char *buffer) {
    return 0;
}

void tree_sitter_zag_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
}

static void advance(TSLexer *lexer) {
    lexer->advance(lexer, false);
}

static void skip(TSLexer *lexer) {
    lexer->advance(lexer, true);
}

static bool scan_whitespace(TSLexer *lexer) {
    for (;;) {
        while (iswspace(lexer->lookahead)) {
            skip(lexer);
        }

        if (lexer->lookahead == '/') {
            skip(lexer);

            if (lexer->lookahead == '/') {
                skip(lexer);
                while (lexer->lookahead != 0 && lexer->lookahead != '\n' && lexer->lookahead != '\r') {
                    skip(lexer);
                }
            } else if (lexer->lookahead == '*') {
                skip(lexer);
                while (true) {
                    if (lexer->lookahead == 0) {
                        return false;
                    }
                    if (lexer->lookahead == '*') {
                        skip(lexer);
                        if (lexer->lookahead == '/') {
                            skip(lexer);
                            break;
                        }
                    } else {
                        skip(lexer);
                    }
                }
            } else {
                return false;
            }
        } else {
            break;
        }
    }

    return true;
}

static bool scan_automatic_semicolon(TSLexer *lexer) {
    lexer->result_symbol = AUTOMATIC_SEMICOLON;
    lexer->mark_end(lexer);

    bool sameline = true;
    for (;;) {
        if (lexer->eof(lexer)) {
            return true;
        }

        if (lexer->lookahead == ' ' || lexer->lookahead == '\t' || lexer->lookahead == '\r') {
            skip(lexer);
        } else if (lexer->lookahead == '\n') {
            skip(lexer);
            sameline = false;
        } else if (lexer->lookahead == '/') {
            skip(lexer);
            if (lexer->lookahead == '/') {
                // Line comment - skip to end of line
                while (lexer->lookahead != 0 && lexer->lookahead != '\n') {
                    skip(lexer);
                }
            } else if (lexer->lookahead == '*') {
                // Block comment
                skip(lexer);
                while (true) {
                    if (lexer->lookahead == 0) {
                        return false;
                    }
                    if (lexer->lookahead == '\n') {
                        sameline = false;
                    }
                    if (lexer->lookahead == '*') {
                        skip(lexer);
                        if (lexer->lookahead == '/') {
                            skip(lexer);
                            break;
                        }
                    } else {
                        skip(lexer);
                    }
                }
            } else {
                return false;
            }
        } else {
            break;
        }
    }

    if (sameline) {
        return false;
    }

    // Check for tokens that can appear after automatic semicolon
    switch (lexer->lookahead) {
        case '}':
        case ')':
        case ']':
            return true;
        default:
            return false;
    }
}

bool tree_sitter_zag_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
    if (valid_symbols[AUTOMATIC_SEMICOLON]) {
        return scan_automatic_semicolon(lexer);
    }

    return false;
}