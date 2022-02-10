const selectorParser = require("../../packages/postcss-selector-parser");
const resolveNestedSelector = require("../../packages/postcss-resolve-nested-selector");
const report = require("../../shims/stylelint-report");

const cssRuleHasSelectorEndingWithColon = require("../utils/cssRuleHasSelectorEndingWithColon");

const ruleName = "swissquote/no-hack-reassignment";
const messages = {
  rejected: "You cannot reassign a hack"
};

const isHack = /^_/;

function fail(result, rule, selectorNode) {
  report({
    message: messages.rejected,
    node: rule,
    index: selectorNode.sourceIndex,
    ruleName,
    result
  });
}

module.exports = function(/*mainOption, moreOptions*/) {
  return (root, result) => {
    root.walkRules(rule => {
      if (cssRuleHasSelectorEndingWithColon(rule)) {
        return;
      }

      // Resolve nested selectors
      resolveNestedSelector(rule.selector, rule).forEach(selector => {
        selectorParser(selectorAST => {
          selectorAST.walk(selectorNode => {
            // If the selector is a utility class and it has more than
            // one element in the selector, it's considered a reassignment
            if (
              selectorNode.type === "class" &&
              isHack.test(selectorNode.value) &&
              selectorNode.parent.nodes.length > 1
            ) {
              fail(result, rule, selectorNode);
            }
          });
        }).process(selector);
      });
    });
  };
};

module.exports.ruleName = ruleName;

module.exports.messages = messages;
