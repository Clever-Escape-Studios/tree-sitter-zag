/**
 * @file Zag Programming Language
 * @author Jose Joya <ing.jose.joya@gmail.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

export default grammar({
  name: "zag",

  // Common whitespace and comments are extras (skipped in the concrete syntax tree)
  extras: ($) => [/\s+/, $.comment],

  // Top-level entry
  rules: {
    source_file: ($) => repeat($._top_level),

    _top_level: ($) =>
      choice(
        $.package_declaration,
        $.import_declaration,
        $.function_declaration,
        $.type_declaration,
        $.variable_declaration,
        $.constant_declaration,
        $.expression_statement,
      ),

    //
    // Declarations
    //
    package_declaration: ($) => seq("package", field("name", $.identifier)),

    import_declaration: ($) => seq("import", field("path", $.string)),

    function_declaration: ($) =>
      seq(
        optional("extern"),
        "func",
        field("name", $.identifier),
        field("type_params", optional($.type_parameters)),
        field("params", $.parameter_list),
        optional(field("return_type", $.type)),
        field("body", choice($.block, ";")),
      ),

    type_parameters: ($) =>
      seq("<", $.type_parameter, repeat(seq(",", $.type_parameter)), ">"),

    type_parameter: ($) => $.identifier,

    parameter_list: ($) =>
      seq("(", optional(seq($.parameter, repeat(seq(",", $.parameter)))), ")"),

    parameter: ($) => seq(optional($.type), field("name", $.identifier)),

    type_declaration: ($) =>
      seq("type", field("name", $.type_identifier), "=", field("type", $.type)),

    variable_declaration: ($) =>
      seq(
        choice("var", "mut"),
        seq($.variable, repeat(seq(",", $.variable))),
        optional(seq("=", seq($.expression, repeat(seq(",", $.expression))))),
      ),

    constant_declaration: ($) =>
      seq(
        "const",
        seq($.variable, repeat(seq(",", $.variable))),
        optional(seq("=", seq($.expression, repeat(seq(",", $.expression))))),
      ),

    variable: ($) => field("name", $.identifier),

    //
    // Statements & expressions
    //
    expression_statement: ($) => seq($.expression, optional(";")),

    block: ($) => seq("{", repeat($._top_level), "}"),

    expression: ($) =>
      choice(
        $.assignment_expression,
        $.binary_expression,
        $.unary_expression,
        $.call_expression,
        $.index_expression,
        $.field_expression,
        $.literal,
        $.identifier,
        $.parenthesized_expression,
      ),

    parenthesized_expression: ($) => seq("(", $.expression, ")"),

    // assignment has lower precedence than binary
    assignment_expression: ($) =>
      prec.right(
        1,
        seq(
          field(
            "left",
            choice($.identifier, $.index_expression, $.field_expression),
          ),
          field("operator", $.assignment_operator),
          field("right", $.expression),
        ),
      ),

    call_expression: ($) =>
      prec(
        7,
        seq(
          field("function", choice($.identifier, $.field_expression)),
          field("arguments", $.argument_list),
        ),
      ),

    argument_list: ($) =>
      seq(
        "(",
        optional(seq($.expression, repeat(seq(",", $.expression)))),
        ")",
      ),

    index_expression: ($) =>
      seq(
        field(
          "value",
          choice(
            $.identifier,
            $.call_expression,
            $.field_expression,
            $.index_expression,
          ),
        ),
        "[",
        $.expression,
        "]",
      ),

    field_expression: ($) =>
      seq(
        field(
          "value",
          choice($.identifier, $.call_expression, $.field_expression),
        ),
        ".",
        field("field", $.identifier),
      ),

    unary_expression: ($) =>
      prec.right(
        6,
        seq(
          field("operator", choice($.unary_operator)),
          field("operand", $.expression),
        ),
      ),

    binary_expression: ($) =>
      choice(
        prec.left(
          5,
          seq(
            $.expression,
            field("operator", $.multiplicative_operator),
            $.expression,
          ),
        ),
        prec.left(
          4,
          seq(
            $.expression,
            field("operator", $.additive_operator),
            $.expression,
          ),
        ),
        prec.left(
          3,
          seq(
            $.expression,
            field("operator", $.comparison_operator),
            $.expression,
          ),
        ),
        prec.left(
          2,
          seq(
            $.expression,
            field("operator", $.logical_operator),
            $.expression,
          ),
        ),
      ),

    //
    // Literals
    //
    literal: ($) => choice($.number, $.string, $.char, $.boolean, $.nil),

    //
    // Types (basic mapping from TextMate patterns)
    //
    type: ($) =>
      choice(
        $.type_identifier,
        $.pointer_type,
        $.array_type,
        $.map_type,
        $.chan_type,
        $.generic_type,
      ),

    pointer_type: ($) => seq("*", $.type),
    array_type: ($) => seq("[", optional($.number), "]", $.type),
    map_type: ($) => seq("map", "<", $.type, ",", $.type, ">"),
    chan_type: ($) => seq("chan", $.type),
    generic_type: ($) =>
      seq($.type_identifier, "<", $.type, repeat(seq(",", $.type)), ">"),

    //
    // Tokens (mapped from TextMate JSON)
    //
    // Comments
    // Use a greedy match for block comments; the Rust regex engine doesn't support non-greedy quantifiers.
    comment: ($) => token(choice(seq("//", /.*/), seq("/*", /[\s\S]*/, "*/"))),

    // Strings
    string: ($) => choice($.string_double, $.string_single),

    string_double: ($) =>
      token(seq('"', repeat(choice(/[^"\\\n]/, seq("\\", /./))), '"')),

    string_single: ($) =>
      token(seq("'", repeat(choice(/[^'\\\n]/, seq("\\", /./))), "'")),

    // Character literal (single-quoted char), matches TextMate's pattern
    char: ($) => token(seq("'", choice(/\\./, /[^'\\]/), "'")),

    // Numbers (decimal / hex / octal / binary)
    number: ($) =>
      token(
        choice(
          // decimal with optional frac and exponent
          /([0-9]+\.[0-9]+([eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+|[0-9]+)/,
          // hex
          /0[xX][0-9a-fA-F]+/,
          // octal (0o...)
          /0[oO][0-7]+/,
          // binary (0b...)
          /0[bB][01]+/,
        ),
      ),

    // Constants
    boolean: ($) => token(/(true|false)/),
    nil: ($) => token(/nil/),

    //
    // Identifiers
    //
    identifier: ($) => token(/[a-zA-Z_][a-zA-Z0-9_]*/),

    // Type identifiers usually start with uppercase (as per TextMate)
    type_identifier: ($) => token(/[A-Z][a-zA-Z0-9_]*/),

    // Builtin types derived from the TextMate `storage.type.zag` patterns
    builtin_type: ($) =>
      token(
        /(?:int8|int16|int32|uint8|uint16|uint32|uint64|float32|float64|bool|string|char)/,
      ),

    //
    // Operators mapped from TextMate JSON
    //
    assignment_operator: ($) =>
      token(choice("=", "+=", "-=", "*=", "/=", "%=")),

    multiplicative_operator: ($) => token(choice("*", "/", "%")),
    additive_operator: ($) => token(choice("+", "-")),

    comparison_operator: ($) => token(choice("==", "!=", "<=", ">=", "<", ">")),

    logical_operator: ($) => token(choice("&&", "||", "!")),

    unary_operator: ($) => token(choice("!", "-", "+", "&", "*", "<-")),

    // bitwise operator tokenization
    bitwise_operator: ($) => token(choice("&", "|", "^", "<<", ">>")),

    // Channel operator: <- (also included in unary_operator)
    channel_operator: ($) => token("<-"),

    //
    // Keywords (split to help precedence / node naming)
    //
    keyword_control: ($) =>
      token(/(if|else|for|return|switch|case|default|fallthrough)/),
    keyword_other: ($) =>
      token(
        /(package|import|type|struct|func|extern|chan|new|var|const|defer|make|interface|map|zag|mut)/,
      ),

    //
    // Helpers (small reusable pieces)
    //
    // matches variable names starting with lowercase or underscore (from TextMate)
    variable_name: ($) => token(/[a-z_][a-zA-Z0-9_]*/),

    //
    // Punctuation and separators are matched as literal characters in rules
    //
  },
});

/*
 * Utility helper: sep1 (not part of tree-sitter DSL) -- implement as a small macro-like
 * function via vanilla JS patterns is not possible inside grammar definitions, but
 * for readability above we used sep1 in a few places conceptually. To keep this file
 * valid we provide a short inline definition pattern below for the reader:
 *
 * sep1(X, sep) := seq(X, repeat(seq(sep, X)))
 *
 * In this file we used `sep1` only for clarity; tree-sitter parser-generator will
 * accept these constructs if expanded. If you later need me to expand all `sep1`
 * invocations to concrete `seq`/`repeat` forms, tell me and I'll update the file.
 */
