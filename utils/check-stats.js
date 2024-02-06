const { getModulePath, isModule, isExternal } = require("./functions.js");
const isCore = require("is-core-module");

const packageFile = require(`${process.cwd()}/package.json`);

function printStats({ modules }) {
  const packages = modules
    .filter(m => m.nameForCondition != null && isModule(m.name))
    .map(m => getModulePath(m.nameForCondition))
    .reduce((acc, entry) => acc.add(entry), new Set());

  const notPackage = modules.filter(
    m =>
      !isModule(m.name) &&
      !isExternal(m.name) &&
      m.name.indexOf("webpack/") !== 0
  );
  const externals = modules.filter(m => isExternal(m.name));

  console.log(
    modules.length,
    "modules,",
    packages.size,
    "packages,",
    externals.length,
    "externals,",
    notPackage.length,
    "non-package modules"
  );
  console.log("");
}

const depsAliases = {
  "@babel/helper-module-transforms": "@babel/core",
  "@babel/helper-compilation-targets": "@babel/core",
  "@babel/types": "@babel/core",
  "@babel/template": "@babel/core",
  "@babel/traverse": "@babel/core"
};

const unnecessaryPackages = new Set();
unnecessaryPackages.add("pnpapi");
unnecessaryPackages.add("@microsoft/typescript-etw");
unnecessaryPackages.add("sugarss");

const depsAllowlist = new Set();
depsAllowlist.add("@swissquote/crafty-preset-eslint");
depsAllowlist.add("open");

function inDeps(dependency) {
  // Some packages don't need to be present at all
  if (unnecessaryPackages.has(dependency)) {
    return true;
  }

  let result = false;
  const toCheck = depsAliases.hasOwnProperty(dependency)
    ? depsAliases[dependency]
    : dependency;

  if (
    packageFile.dependencies &&
    packageFile.dependencies.hasOwnProperty(toCheck)
  ) {
    result = true;
  }

  if (
    packageFile.peerDependencies &&
    packageFile.peerDependencies.hasOwnProperty(toCheck)
  ) {
    result = true;
  }

  if (
    packageFile.optionalDependencies &&
    packageFile.optionalDependencies.hasOwnProperty(toCheck)
  ) {
    result = true;
  }

  if (!result && depsAllowlist.has(dependency)) {
    console.log(
      `WARNING: Allowing dependency ${dependency} even though it's not in dependencies.`
    );
    return true;
  }

  return result;
}

function checkStats(stats, statFile) {
  printStats(stats);

  const errors = [];

  function recordError(error) {
    errors.push(error);
  }

  // All packages must be found
  stats.modules
    .filter(m => m.name.indexOf("/ncc/@@notfound") > -1)
    .map(
      m =>
        `Module "${m.name.split("?")[1]}" requested by "${
          m.issuerName
        }" was not found.`
    )
    .map(recordError);

  // Packages provided by another module should stay external
  stats.modules
    .filter(m => m.name.indexOf("/packages/") > -1)
    .filter(m => !isExternal(m.name))
    .map(
      m =>
        `Module "${m.name}" requested by "${m.issuerName}" should be external.`
    )
    .map(recordError);

  // All readable-stream packages must be external
  stats.modules
    .filter(m => !isExternal(m.name))
    .filter(m => {
      // Never accept those packages
      if (
        m.name.indexOf("node_modules/readable-stream/") > -1 ||
        m.name.indexOf("node_modules/typescript/") > -1
      ) {
        return true;
      }

      // Only accept stylelint in some files
      if (
        m.name.indexOf("node_modules/stylelint/") > -1 &&
        !statFile.includes("stylelint")
      ) {
        return true;
      }

      return false;
    })
    .map(
      m =>
        `Module "${m.name}" requested by "${m.issuerName}" should be external.`
    )
    .map(recordError);

  // All external modules should be in dependencies or peerDependencies
  // If not, module resolution and hoisting may have an unexpected behaviour
  const externals = stats.modules
    .filter((m) => isExternal(m.name))
    .map((m) => m.name.replace("external ", "").replace(/"/g, "").replace(/^\[|\]$/g, ""))
    .filter((m) => m[0] !== ".") // exclude relative paths
    .map((m) => {
      const p = m.split(/\//g);

      if (m.startsWith("@")) {
        return `${p[0]}/${p[1]}`;
      }

      return p[0];
    })
    .filter(item => !isCore(item))
    .reduce((acc, item) => acc.add(item), new Set());

  for (const external of externals) {
    if (!inDeps(external)) {
      recordError(
        `Module "${external}" is absent from the package's dependencies.`
      );
    }
  }

  if (errors.length > 0) {
    const message = `${errors.length} errors found`;
    console.log(message);
    console.log("=".repeat(message.length));
    errors.forEach(m => {
      console.log(m);
    });

    console.log();
    process.exit(1);
  }
}

module.exports = checkStats;
