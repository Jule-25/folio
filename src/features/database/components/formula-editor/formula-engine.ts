import { useSyncExternalStore } from "react";
// A type-only import is erased from the build: it doesn't pull mathjs in.
import type { MathJsInstance } from "mathjs";

// The formula engine (mathjs, ~185 KB gzipped) is downloaded the first time a
// formula is evaluated, not with the app. Until then evaluateFormula returns
// null; components that show formula results call useFormulaEngineReady() so
// they re-render once it has loaded.

let engine: MathJsInstance | null = null;
let loading: Promise<MathJsInstance> | null = null;
const listeners = new Set<() => void>();

/** The engine if it has loaded, otherwise null. */
export function getFormulaEngine(): MathJsInstance | null {
  return engine;
}

/** Starts the download (once) and resolves with the configured engine. */
export function loadFormulaEngine(): Promise<MathJsInstance> {
  loading ??= import("mathjs").then(({ create, all }) => {
    const math = create(all);
    configure(math);
    engine = math;
    listeners.forEach((notify) => notify());
    return math;
  });
  return loading;
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** True once the engine has loaded; re-renders the caller when it does. */
export function useFormulaEngineReady(): boolean {
  return useSyncExternalStore(subscribe, () => engine !== null);
}

// Folio's additions to mathjs (moved here from formula-evaluator.ts).
function configure(math: MathJsInstance) {
  // Override equal/unequal to use strict JS equality so strings work correctly.
  // Ordering comparisons with an empty side are false (an empty date is neither
  // before nor after anything), instead of JS's null → 0.
  const isBlank = (v: unknown) => v === null || v === undefined || v === "";
  math.import(
    {
      equal: (a: unknown, b: unknown) => a === b,
      unequal: (a: unknown, b: unknown) => a !== b,
      smaller: (a: unknown, b: unknown) =>
        !isBlank(a) && !isBlank(b) && (a as number) < (b as number),
      larger: (a: unknown, b: unknown) =>
        !isBlank(a) && !isBlank(b) && (a as number) > (b as number),
      smallerEq: (a: unknown, b: unknown) =>
        !isBlank(a) && !isBlank(b) && (a as number) <= (b as number),
      largerEq: (a: unknown, b: unknown) =>
        !isBlank(a) && !isBlank(b) && (a as number) >= (b as number),
    },
    { override: true },
  );

  // "a" + "b" joins text, like Notion ("Total: " + 3 → "Total: 3"). Numbers,
  // matrices etc. keep mathjs's own add (typed signatures merge).
  math.import({
    add: math.typed("add", {
      "string, string": (a: string, b: string) => a + b,
      "string, number": (a: string, b: number) => a + String(b),
      "number, string": (a: number, b: string) => String(a) + b,
      "string, boolean": (a: string, b: boolean) => a + String(b),
      "boolean, string": (a: boolean, b: string) => String(a) + b,
      // An empty value joins as nothing: "Due " + prop("Due") on an empty date.
      "string, null": (a: string) => a,
      "null, string": (_a: null, b: string) => b,
    }),
  });

  // Lazy logic: only the branch that's taken is evaluated, so
  // if(empty(prop("Due")), "", dateBetween(prop("Due"), now(), "days")) works
  // on rows without a date. rawArgs functions get the unevaluated argument
  // nodes; they must live on the math instance (scope functions are eager).
  type RawNode = { compile: () => { evaluate: (scope: unknown) => unknown } };
  type RawFn = ((args: RawNode[], m: unknown, scope: unknown) => unknown) & {
    rawArgs?: boolean;
  };
  const lazy = (fn: RawFn): RawFn => {
    fn.rawArgs = true;
    return fn;
  };
  const run = (node: RawNode | undefined, scope: unknown) =>
    node ? node.compile().evaluate(scope) : null;

  math.import({
    _if: lazy((args, _m, scope) =>
      run(args[0], scope) ? run(args[1], scope) : run(args[2], scope),
    ),
    ifs: lazy((args, _m, scope) => {
      for (let i = 0; i + 1 < args.length; i += 2) {
        if (run(args[i], scope)) return run(args[i + 1], scope);
      }
      return args.length % 2 !== 0 ? run(args[args.length - 1], scope) : null;
    }),
    _and: lazy((args, _m, scope) => args.every((a) => Boolean(run(a, scope)))),
    _or: lazy((args, _m, scope) => args.some((a) => Boolean(run(a, scope)))),
  });
}
