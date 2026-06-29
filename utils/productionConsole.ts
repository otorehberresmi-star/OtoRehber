import { reportError } from "./errorReporting";

const isProduction = process.env.NODE_ENV === "production";

export function configureProductionConsole() {
  if (!isProduction) return;

  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.trace = () => {};

  console.error = (...args: unknown[]) => {
    reportError(args[0] instanceof Error ? args[0] : new Error(String(args[0])), {
      consoleArgs: args.slice(1).map(String),
      level: "error",
    });
  };

  console.warn = (...args: unknown[]) => {
    reportError(args[0] instanceof Error ? args[0] : new Error(String(args[0])), {
      consoleArgs: args.slice(1).map(String),
      level: "warn",
    });
  };
}
