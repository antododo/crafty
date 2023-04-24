const path = require("path");
const fs = require("fs");
const childProcess = require("child_process");

function normalizeJestOptions(crafty, cli, esmMode, args) {
  const moduleDirectories = new Set(["node_modules"]);

  if (cli.flags.moduleDirectories) {
    let idx;
    while ((idx = args.indexOf("--moduleDirectories")) > -1) {
      args.splice(idx, 2);
    }

    cli.flags.moduleDirectories
      .split(",")
      .forEach(module => moduleDirectories.add(module));
  }

  const moduleFileExtensions = new Set(["js", "json", "mjs", "cjs"]);
  if (cli.flags.moduleFileExtensions) {
    let idx;
    while ((idx = args.indexOf("--moduleFileExtensions")) > -1) {
      args.splice(idx, 2);
    }

    cli.flags.moduleFileExtensions
      .split(",")
      .forEach(extension => moduleFileExtensions.add(extension));
  }

  const options = {
    moduleDirectories: [...moduleDirectories],
    moduleFileExtensions: [...moduleFileExtensions],
    testPathIgnorePatterns: ["/node_modules/", crafty.config.destination],
    moduleNameMapper: {
      "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": require.resolve(
        "./file-mock"
      ),
      "\\.(css|less|sass|scss)$": require.resolve("./style-mock")
    },
    bail: true,
    roots: [process.cwd()],
    transform: {},
    resolver: require.resolve("./resolver.js"),
    globals: {}
  };

  if (!esmMode) {
    // Add custom transformer to ES import/export in node_modules
    options.transformIgnorePatterns = [];
    options.transform["[/\\\\]node_modules[/\\\\].+\\.m?js$"] = require.resolve(
      "./esm-transformer"
    );
  }

  crafty.runAllSync("jest", crafty, options, esmMode);

  // Support all extensions that can be transformed for test files extensions, except for json
  const extensions = options.moduleFileExtensions
    .filter(extension => extension !== "json")
    .join("|");
  options.testRegex = `(/__tests__/.*|(\\.|/)(test|spec))\\.(${extensions})$`;

  return options;
}

function deleteOnExit(file) {
  process.addListener("exit", () => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      console.error("Failed to delete ", file, e);
    }
  });
}

function isModuleMode() {
  const packageJson = path.join(process.cwd(), "package.json");

  if (fs.existsSync(packageJson)) {
    return require(packageJson).type === "module";
  }

  return false;
}

module.exports = {
  ide(crafty, input, cli) {
    const esmMode = isModuleMode();
    return {
      "jest.config.js": {
        content: normalizeJestOptions(crafty, cli, esmMode, []),
        serializer: content => `// This configuration was generated by Crafty
// This file is generated to improve IDE Integration
// You don't need to commit this file, nor need it to run \`crafty test\`

module.exports = ${JSON.stringify(content, null, 4)};
`
      }
    };
  },
  test(crafty, input, cli) {
    return new Promise((resolve, reject) => {
      // Create config file in the current working directory
      // Creating it in a temp path breaks code coverage collection
      const configFile = path.join(process.cwd(), "jest-config-crafty.json");
      deleteOnExit(configFile);

      const esmMode = isModuleMode();

      // node crafty test <keep next args>
      const argv = [path.join(__dirname, "run.js"), ...process.argv.slice(3)];

      // Start node with --experimental-vm-modules
      // in case the package is in module mode
      if (esmMode) {
        argv.unshift("--experimental-vm-modules");
      }

      const options = normalizeJestOptions(crafty, cli, esmMode, argv);

      // Write options to file and set config file option
      fs.writeFileSync(configFile, `${JSON.stringify(options, null, 2)}\n`);
      argv.push("--config");
      argv.push(configFile);

      const child = childProcess.spawn(process.argv[0], argv, {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit"
      });

      child.on("error", reject);
      child.on("close", resolve);
    });
  }
};
